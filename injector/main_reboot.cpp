#include <Windows.h>
#include <TlHelp32.h>
#include <iostream>
#include <string>
#include <filesystem>
#include <thread>
#include <chrono>

namespace fs = std::filesystem;

// Suspend a process by PID
bool SuspendProcess(DWORD pid) {
    typedef LONG(NTAPI* NtSuspendProcess)(HANDLE ProcessHandle);
    NtSuspendProcess pfnNtSuspendProcess = (NtSuspendProcess)GetProcAddress(
        GetModuleHandleA("ntdll"), "NtSuspendProcess");
    
    if (!pfnNtSuspendProcess) {
        std::cerr << "[ERROR] Failed to get NtSuspendProcess address" << std::endl;
        return false;
    }
    
    HANDLE hProcess = OpenProcess(PROCESS_ALL_ACCESS, FALSE, pid);
    if (!hProcess) {
        std::cerr << "[ERROR] Failed to open process for suspend. Error: " << GetLastError() << std::endl;
        return false;
    }
    
    LONG result = pfnNtSuspendProcess(hProcess);
    CloseHandle(hProcess);
    
    if (result != 0) {
        std::cerr << "[ERROR] Failed to suspend process. Result: " << result << std::endl;
        return false;
    }
    
    std::cout << "[SUCCESS] Process " << pid << " suspended" << std::endl;
    return true;
}

bool InjectDLL(DWORD processId, const std::wstring& dllPath) {
    // Get full path to DLL
    std::wstring fullPath = fs::absolute(dllPath).wstring();
    
    std::wcout << L"[Injector] Injecting: " << fullPath << std::endl;
    std::wcout << L"[Injector] Target PID: " << processId << std::endl;
    
    // Open target process
    HANDLE hProcess = OpenProcess(PROCESS_ALL_ACCESS, FALSE, processId);
    if (!hProcess) {
        std::cerr << "[Injector] Failed to open process. Error: " << GetLastError() << std::endl;
        return false;
    }
    
    // Allocate memory in target process
    SIZE_T pathSize = (fullPath.length() + 1) * sizeof(wchar_t);
    LPVOID pRemotePath = VirtualAllocEx(hProcess, nullptr, pathSize, 
        MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
    
    if (!pRemotePath) {
        std::cerr << "[Injector] Failed to allocate memory. Error: " << GetLastError() << std::endl;
        CloseHandle(hProcess);
        return false;
    }
    
    // Write DLL path to target process
    if (!WriteProcessMemory(hProcess, pRemotePath, fullPath.c_str(), pathSize, nullptr)) {
        std::cerr << "[Injector] Failed to write memory. Error: " << GetLastError() << std::endl;
        VirtualFreeEx(hProcess, pRemotePath, 0, MEM_RELEASE);
        CloseHandle(hProcess);
        return false;
    }
    
    // Get LoadLibraryW address
    HMODULE hKernel32 = GetModuleHandleW(L"kernel32.dll");
    LPVOID pLoadLibraryW = GetProcAddress(hKernel32, "LoadLibraryW");
    
    if (!pLoadLibraryW) {
        std::cerr << "[Injector] Failed to get LoadLibraryW address" << std::endl;
        VirtualFreeEx(hProcess, pRemotePath, 0, MEM_RELEASE);
        CloseHandle(hProcess);
        return false;
    }
    
    // Create remote thread to load DLL
    HANDLE hThread = CreateRemoteThread(hProcess, nullptr, 0,
        (LPTHREAD_START_ROUTINE)pLoadLibraryW, pRemotePath, 0, nullptr);
    
    if (!hThread) {
        std::cerr << "[Injector] Failed to create remote thread. Error: " << GetLastError() << std::endl;
        VirtualFreeEx(hProcess, pRemotePath, 0, MEM_RELEASE);
        CloseHandle(hProcess);
        return false;
    }
    
    // Wait for DLL to load
    WaitForSingleObject(hThread, INFINITE);
    
    // Get exit code (module handle)
    DWORD exitCode = 0;
    GetExitCodeThread(hThread, &exitCode);
    
    // Cleanup
    CloseHandle(hThread);
    VirtualFreeEx(hProcess, pRemotePath, 0, MEM_RELEASE);
    CloseHandle(hProcess);
    
    if (exitCode == 0) {
        std::cerr << "[Injector] DLL failed to load in target process" << std::endl;
        return false;
    }
    
    std::cout << "[Injector] DLL injected successfully! Module handle: 0x" 
              << std::hex << exitCode << std::dec << std::endl;
    return true;
}

// Start a process suspended and return PID
DWORD StartProcessSuspended(const std::wstring& exePath) {
    STARTUPINFOW si = { sizeof(si) };
    PROCESS_INFORMATION pi;
    
    std::wstring cmdLine = L"\"" + exePath + L"\"";
    
    if (!CreateProcessW(
        exePath.c_str(),
        &cmdLine[0],
        nullptr,
        nullptr,
        FALSE,
        CREATE_SUSPENDED,
        nullptr,
        nullptr,
        &si,
        &pi)) {
        return 0;
    }
    
    // Store PID
    DWORD pid = pi.dwProcessId;
    
    // Close handles (process stays suspended)
    CloseHandle(pi.hThread);
    CloseHandle(pi.hProcess);
    
    return pid;
}

DWORD GetProcessIdByName(const std::wstring& processName) {
    HANDLE hSnapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (hSnapshot == INVALID_HANDLE_VALUE) {
        return 0;
    }
    
    PROCESSENTRY32W pe32;
    pe32.dwSize = sizeof(pe32);
    
    if (Process32FirstW(hSnapshot, &pe32)) {
        do {
            if (_wcsicmp(pe32.szExeFile, processName.c_str()) == 0) {
                CloseHandle(hSnapshot);
                return pe32.th32ProcessID;
            }
        } while (Process32NextW(hSnapshot, &pe32));
    }
    
    CloseHandle(hSnapshot);
    return 0;
}

int wmain(int argc, wchar_t* argv[]) {
    std::wcout << L"=== Project Drift Injector (Reboot Method) ===" << std::endl;
    std::wcout << L"Fortnite DLL Injector - Using Reboot Launcher technique" << std::endl;
    std::wcout << L"========================================" << std::endl << std::endl;
    
    if (argc < 3) {
        std::wcerr << L"Usage: injector.exe <game_directory> <dll_path>" << std::endl;
        std::wcerr << L"\nExample:" << std::endl;
        std::wcerr << L"  injector.exe \"C:\\Fortnite 4.5\" \"C:\\bypass.dll\"" << std::endl;
        return 1;
    }
    
    std::wstring gameDir = argv[1];
    std::wstring dllPath = argv[2];
    
    // Build paths
    fs::path gamePath = fs::path(gameDir) / L"FortniteGame" / L"Binaries" / L"Win64";
    std::wstring launcherExe = (gamePath / L"FortniteLauncher.exe").wstring();
    std::wstring eacExe = (gamePath / L"FortniteClient-Win64-Shipping_EAC.exe").wstring();
    std::wstring gameExe = (gamePath / L"FortniteClient-Win64-Shipping.exe").wstring();
    
    // Check if DLL exists
    if (!fs::exists(dllPath)) {
        std::wcerr << L"[ERROR] DLL not found at: " << dllPath << std::endl;
        return 1;
    }
    
    // Check if game exists
    if (!fs::exists(gameExe)) {
        std::wcerr << L"[ERROR] Game executable not found at: " << gameExe << std::endl;
        return 1;
    }
    
    std::wcout << L"[1/6] Starting FortniteLauncher.exe (suspended)..." << std::endl;
    DWORD launcherPid = 0;
    if (fs::exists(launcherExe)) {
        launcherPid = StartProcessSuspended(launcherExe);
        if (launcherPid) {
            std::wcout << L"  ✓ FortniteLauncher started (PID: " << launcherPid << L", suspended)" << std::endl;
        } else {
            std::wcout << L"  ⚠ Failed to start FortniteLauncher (non-critical)" << std::endl;
        }
    } else {
        std::wcout << L"  ⚠ FortniteLauncher.exe not found (skipping)" << std::endl;
    }
    
    std::wcout << L"[2/6] Starting EAC process (suspended)..." << std::endl;
    DWORD eacPid = 0;
    if (fs::exists(eacExe)) {
        eacPid = StartProcessSuspended(eacExe);
        if (eacPid) {
            std::wcout << L"  ✓ EAC started (PID: " << eacPid << L", suspended)" << std::endl;
        } else {
            std::wcout << L"  ⚠ Failed to start EAC (non-critical)" << std::endl;
        }
    } else {
        std::wcout << L"  ⚠ EAC exe not found (skipping)" << std::endl;
    }
    
    std::wcout << L"[3/6] Starting Fortnite..." << std::endl;
    
    // Build launch arguments
    std::wstring args = L"-epicapp=Fortnite -epicenv=Prod -epicportal -epiclocale=en-us "
                       L"-skippatchcheck -HTTP=WinInet -NOSSLPINNING "
                       L"-fromfl=eac -fltoken=3db3ba5dcbd2e16703f3978d -nobe -noeac";
    
    std::wstring cmdLine = L"\"" + gameExe + L"\" " + args;
    
    STARTUPINFOW si = { sizeof(si) };
    PROCESS_INFORMATION pi;
    
    if (!CreateProcessW(
        gameExe.c_str(),
        &cmdLine[0],
        nullptr,
        nullptr,
        FALSE,
        0,
        nullptr,
        gamePath.wstring().c_str(),
        &si,
        &pi)) {
        std::wcerr << L"[ERROR] Failed to start Fortnite. Error: " << GetLastError() << std::endl;
        return 1;
    }
    
    DWORD gamePid = pi.dwProcessId;
    CloseHandle(pi.hThread);
    CloseHandle(pi.hProcess);
    
    std::wcout << L"  ✓ Fortnite started (PID: " << gamePid << L")" << std::endl;
    
    std::wcout << L"[4/6] Waiting for game to initialize..." << std::endl;
    std::this_thread::sleep_for(std::chrono::seconds(2));
    
    std::wcout << L"[5/6] Injecting bypass DLL..." << std::endl;
    if (!InjectDLL(gamePid, dllPath)) {
        std::wcerr << L"[ERROR] DLL injection failed!" << std::endl;
        return 1;
    }
    
    std::wcout << L"[6/6] Cleanup complete!" << std::endl;
    std::wcout << L"" << std::endl;
    std::wcout << L"========================================" << std::endl;
    std::wcout << L"SUCCESS! Fortnite launched with bypass DLL" << std::endl;
    std::wcout << L"========================================" << std::endl;
    std::wcout << L"" << std::endl;
    std::wcout << L"Game PID: " << gamePid << std::endl;
    if (launcherPid) std::wcout << L"Launcher PID: " << launcherPid << L" (suspended)" << std::endl;
    if (eacPid) std::wcout << L"EAC PID: " << eacPid << L" (suspended)" << std::endl;
    std::wcout << L"" << std::endl;
    std::wcout << L"Make sure MCP backend is running on port 3551!" << std::endl;
    
    return 0;
}
