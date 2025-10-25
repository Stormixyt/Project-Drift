#pragma once
#include <Windows.h>
#include <winternl.h>
#include <Psapi.h>
#include <string>
#include <vector>
#include "minhook/MinHook.h"

#pragma comment(lib, "ntdll.lib")
#pragma comment(lib, "Psapi.lib")

// NTSTATUS macros
#ifndef NT_SUCCESS
#define NT_SUCCESS(Status) (((NTSTATUS)(Status)) >= 0)
#endif
#ifndef STATUS_PORT_NOT_SET
#define STATUS_PORT_NOT_SET ((NTSTATUS)0xC0000353L)
#endif

// Function pointer types
typedef void* (*LoadPackageAsyncType)(void* thisptr, const wchar_t* packageName, int flags);
typedef BOOL (WINAPI* IsDebuggerPresentType)();
typedef NTSTATUS (NTAPI* NtQueryInformationProcessType)(HANDLE, UINT, PVOID, ULONG, PULONG);

// Original function pointers
LoadPackageAsyncType oLoadPackageAsync = nullptr;
IsDebuggerPresentType oIsDebuggerPresent = nullptr;
NtQueryInformationProcessType oNtQueryInformationProcess = nullptr;

// Log helper
void Log(const std::string& message) {
    OutputDebugStringA(("[Project Drift] " + message).c_str());
}

// Hook: LoadPackageAsync - handles empty/missing package names
void* hkLoadPackageAsync(void* thisptr, const wchar_t* packageName, int flags) {
    // If package name is null or empty, provide a default
    if (!packageName || wcslen(packageName) == 0) {
        Log("LoadPackageAsync called with empty package, using default map");
        // Use Athena_Terrain as default for most builds
        packageName = L"/Game/Athena/Maps/Athena_Terrain";
    }
    
    // Convert wstring to string for logging
    std::wstring pkg(packageName);
    std::string logMsg = "LoadPackageAsync: ";
    for (wchar_t c : pkg) {
        logMsg += (char)c; // Simplified conversion for ASCII chars
    }
    Log(logMsg);
    
    return oLoadPackageAsync(thisptr, packageName, flags);
}

// Hook: IsDebuggerPresent - always return false
BOOL WINAPI hkIsDebuggerPresent() {
    return FALSE;
}

// Hook: NtQueryInformationProcess - hide debugger
NTSTATUS NTAPI hkNtQueryInformationProcess(
    HANDLE ProcessHandle,
    UINT ProcessInformationClass,
    PVOID ProcessInformation,
    ULONG ProcessInformationLength,
    PULONG ReturnLength) {
    
    NTSTATUS status = oNtQueryInformationProcess(
        ProcessHandle,
        ProcessInformationClass,
        ProcessInformation,
        ProcessInformationLength,
        ReturnLength
    );
    
    // ProcessDebugPort (7) - return 0 to hide debugger
    if (ProcessInformationClass == 7 && NT_SUCCESS(status)) {
        *(PDWORD)ProcessInformation = 0;
    }
    
    // ProcessDebugObjectHandle (30) - return failure
    if (ProcessInformationClass == 30) {
        return STATUS_PORT_NOT_SET;
    }
    
    return status;
}

// Pattern scanning
uintptr_t FindPattern(const char* moduleName, const char* pattern, const char* mask) {
    HMODULE module = GetModuleHandleA(moduleName);
    if (!module) return 0;
    
    MODULEINFO moduleInfo;
    GetModuleInformation(GetCurrentProcess(), module, &moduleInfo, sizeof(MODULEINFO));
    
    uintptr_t base = (uintptr_t)module;
    size_t size = moduleInfo.SizeOfImage;
    size_t patternLength = strlen(mask);
    
    for (size_t i = 0; i < size - patternLength; i++) {
        bool found = true;
        for (size_t j = 0; j < patternLength; j++) {
            if (mask[j] != '?' && pattern[j] != *(char*)(base + i + j)) {
                found = false;
                break;
            }
        }
        if (found) {
            return base + i;
        }
    }
    
    return 0;
}

// Initialize hooks
bool InitializeHooks() {
    Log("Initializing Project Drift bypass hooks...");
    
    if (MH_Initialize() != MH_OK) {
        Log("Failed to initialize MinHook");
        return false;
    }
    
    // Hook IsDebuggerPresent
    if (MH_CreateHook(&IsDebuggerPresent, &hkIsDebuggerPresent, 
        reinterpret_cast<LPVOID*>(&oIsDebuggerPresent)) != MH_OK) {
        Log("Failed to hook IsDebuggerPresent");
    } else {
        MH_EnableHook(&IsDebuggerPresent);
        Log("Hooked IsDebuggerPresent");
    }
    
    // Hook NtQueryInformationProcess
    HMODULE ntdll = GetModuleHandleA("ntdll.dll");
    if (ntdll) {
        auto pNtQuery = GetProcAddress(ntdll, "NtQueryInformationProcess");
        if (pNtQuery) {
            if (MH_CreateHook(pNtQuery, &hkNtQueryInformationProcess,
                reinterpret_cast<LPVOID*>(&oNtQueryInformationProcess)) == MH_OK) {
                MH_EnableHook(pNtQuery);
                Log("Hooked NtQueryInformationProcess");
            }
        }
    }
    
    // Find and hook LoadPackageAsync
    // Pattern for UE4 LoadPackageAsync (will need to be updated per version)
    // This is a placeholder - actual pattern needs to be found via reverse engineering
    uintptr_t loadPackageAddr = 0;
    
    // Try to find it in FortniteClient-Win64-Shipping.exe
    const char* pattern = "\x48\x89\x5C\x24\x00\x48\x89\x74\x24\x00\x57\x48\x83\xEC\x20\x48\x8B\xF9";
    const char* mask = "xxxx?xxxx?xxxxxxxx";
    
    loadPackageAddr = FindPattern("FortniteClient-Win64-Shipping.exe", pattern, mask);
    
    if (loadPackageAddr) {
        Log("Found LoadPackageAsync at: " + std::to_string(loadPackageAddr));
        if (MH_CreateHook((LPVOID)loadPackageAddr, &hkLoadPackageAsync,
            reinterpret_cast<LPVOID*>(&oLoadPackageAsync)) == MH_OK) {
            MH_EnableHook((LPVOID)loadPackageAddr);
            Log("Hooked LoadPackageAsync");
        }
    } else {
        Log("Could not find LoadPackageAsync pattern - map loading may fail");
    }
    
    Log("Hook initialization complete");
    return true;
}

// Cleanup hooks
void CleanupHooks() {
    Log("Cleaning up hooks...");
    MH_DisableHook(MH_ALL_HOOKS);
    MH_Uninitialize();
}
