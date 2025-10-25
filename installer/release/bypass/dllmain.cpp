#include <Windows.h>
#include "hooks.h"

// Fake Epic Games Launcher window
HWND g_FakeLauncherWindow = NULL;

LRESULT CALLBACK FakeLauncherWndProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    switch (msg) {
    case WM_DESTROY:
        PostQuitMessage(0);
        return 0;
    }
    return DefWindowProc(hwnd, msg, wParam, lParam);
}

DWORD WINAPI FakeLauncherThread(LPVOID lpParam) {
    // Register window class
    WNDCLASSEX wc = { 0 };
    wc.cbSize = sizeof(WNDCLASSEX);
    wc.lpfnWndProc = FakeLauncherWndProc;
    wc.hInstance = GetModuleHandle(NULL);
    wc.lpszClassName = L"EpicGamesLauncher";  // Use unique class name
    wc.hbrBackground = (HBRUSH)(COLOR_WINDOW + 1);
    
    // Try to unregister first in case it exists
    UnregisterClass(wc.lpszClassName, wc.hInstance);
    
    if (!RegisterClassEx(&wc)) {
        DWORD error = GetLastError();
        if (error == ERROR_CLASS_ALREADY_EXISTS) {
            Log("Window class already exists, continuing anyway");
        } else {
            char errBuf[256];
            sprintf_s(errBuf, "Failed to register window class, error: %lu", error);
            Log(errBuf);
            // Don't return - try to continue without the window
        }
    }
    
    // Create hidden window to mimic Epic Games Launcher
    g_FakeLauncherWindow = CreateWindowEx(
        0,
        L"EpicGamesLauncher",
        L"Epic Games Launcher",
        WS_OVERLAPPEDWINDOW,
        CW_USEDEFAULT, CW_USEDEFAULT, 800, 600,
        NULL, NULL, wc.hInstance, NULL
    );
    
    if (!g_FakeLauncherWindow) {
        char errBuf[256];
        sprintf_s(errBuf, "Failed to create window, error: %lu - continuing without it", GetLastError());
        Log(errBuf);
        // Don't return - the game might work without the window
    } else {
        Log("Fake Epic Games Launcher window created (hidden)");
    }
    
    // Keep window alive but hidden
    MSG msg;
    while (GetMessage(&msg, NULL, 0, 0)) {
        TranslateMessage(&msg);
        DispatchMessage(&msg);
    }
    
    return 0;
}

DWORD WINAPI InitThread(LPVOID lpParam) {
    // Wait for game to initialize
    Sleep(2000);
    
    // Create fake launcher window first
    CreateThread(nullptr, 0, FakeLauncherThread, nullptr, 0, nullptr);
    Sleep(500); // Wait for window creation
    
    // Initialize all hooks
    if (InitializeHooks()) {
        Log("Project Drift bypass loaded successfully!");
        Log("Standalone mode enabled - Epic launcher checks bypassed");
    } else {
        Log("Failed to initialize bypass hooks");
    }
    
    return 0;
}

BOOL APIENTRY DllMain(HMODULE hModule, DWORD ul_reason_for_call, LPVOID lpReserved) {
    switch (ul_reason_for_call) {
    case DLL_PROCESS_ATTACH:
        DisableThreadLibraryCalls(hModule);
        CreateThread(nullptr, 0, InitThread, hModule, 0, nullptr);
        break;
    case DLL_PROCESS_DETACH:
        CleanupHooks();
        if (g_FakeLauncherWindow) {
            DestroyWindow(g_FakeLauncherWindow);
        }
        break;
    }
    return TRUE;
}
