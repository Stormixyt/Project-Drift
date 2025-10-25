#include <Windows.h>

// Fake Epic Games Launcher
// This process just sits idle to satisfy Fortnite's process checks

int WINAPI WinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance, LPSTR lpCmdLine, int nCmdShow) {
    // Set process name visible in Task Manager
    SetConsoleTitle(L"EpicGamesLauncher");
    
    // Create a hidden window to keep process alive
    WNDCLASS wc = { 0 };
    wc.lpfnWndProc = DefWindowProc;
    wc.hInstance = hInstance;
    wc.lpszClassName = L"EpicGamesLauncher";
    RegisterClass(&wc);
    
    HWND hwnd = CreateWindow(
        L"EpicGamesLauncher",
        L"Epic Games Launcher",
        0,  // Hidden
        0, 0, 0, 0,
        NULL, NULL, hInstance, NULL
    );
    
    // Message loop to keep process alive
    MSG msg;
    while (GetMessage(&msg, NULL, 0, 0)) {
        TranslateMessage(&msg);
        DispatchMessage(&msg);
    }
    
    return 0;
}
