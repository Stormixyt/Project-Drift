#include <Windows.h>
#include <TlHelp32.h>
#include <iostream>
#include <string>
#include <filesystem>

namespace fs = std::filesystem;

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
    std::wcout << L"=== Project Drift Injector ===" << std::endl;
    std::wcout << L"Fortnite Bypass DLL Injector" << std::endl;
    std::wcout << L"==============================" << std::endl << std::endl;
    
    if (argc < 2) {
        std::wcerr << L"Usage: injector.exe <PID> [dll_path]" << std::endl;
        std::wcerr << L"   or: injector.exe <process_name> [dll_path]" << std::endl;
        std::wcerr << L"\nExamples:" << std::endl;
        std::wcerr << L"  injector.exe 12345" << std::endl;
        std::wcerr << L"  injector.exe FortniteClient-Win64-Shipping.exe" << std::endl;
        std::wcerr << L"  injector.exe 12345 C:\\path\\to\\bypass.dll" << std::endl;
        return 1;
    }
    
    // Determine DLL path
    std::wstring dllPath;
    if (argc >= 3) {
        dllPath = argv[2];
    } else {
        // Default: bypass.dll in same directory as injector
        wchar_t exePath[MAX_PATH];
        GetModuleFileNameW(nullptr, exePath, MAX_PATH);
        fs::path exeDir = fs::path(exePath).parent_path();
        dllPath = (exeDir / L"bypass.dll").wstring();
    }
    
    // Check if DLL exists
    if (!fs::exists(dllPath)) {
        std::wcerr << L"[Injector] Error: DLL not found at: " << dllPath << std::endl;
        std::wcerr << L"[Injector] Please build bypass.dll first or specify correct path" << std::endl;
        return 1;
    }
    
    // Get target process ID
    DWORD targetPid = 0;
    std::wstring arg1 = argv[1];
    
    // Check if arg1 is a number (PID) or process name
    try {
        targetPid = std::stoul(arg1);
        std::wcout << L"[Injector] Using PID: " << targetPid << std::endl;
    } catch (...) {
        // It's a process name
        std::wcout << L"[Injector] Searching for process: " << arg1 << std::endl;
        targetPid = GetProcessIdByName(arg1);
        
        if (targetPid == 0) {
            std::wcerr << L"[Injector] Process not found: " << arg1 << std::endl;
            std::wcerr << L"[Injector] Make sure Fortnite is running" << std::endl;
            return 1;
        }
        
        std::wcout << L"[Injector] Found process with PID: " << targetPid << std::endl;
    }
    
    // Verify process exists
    HANDLE hCheck = OpenProcess(PROCESS_QUERY_INFORMATION, FALSE, targetPid);
    if (!hCheck) {
        std::wcerr << L"[Injector] Process with PID " << targetPid << L" not found or access denied" << std::endl;
        return 1;
    }
    CloseHandle(hCheck);
    
    // Inject DLL
    std::wcout << L"\n[Injector] Starting injection..." << std::endl;
    if (InjectDLL(targetPid, dllPath)) {
        std::wcout << L"\n[SUCCESS] Bypass loaded successfully!" << std::endl;
        std::wcout << L"[SUCCESS] Fortnite should now run without Epic launcher" << std::endl;
        return 0;
    } else {
        std::wcerr << L"\n[FAILED] Injection failed" << std::endl;
        std::wcerr << L"[FAILED] Try running as administrator" << std::endl;
        return 1;
    }
}
