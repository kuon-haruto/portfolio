using System;

namespace TechC.VBattle.Core.Window
{
    public static class WindowClassManager
    {
        public static void RegisterWindowClasses() { }
        public static void UnregisterWindowClasses() => BrowserWindowSurface.Clear();
        public static IntPtr CreateWindow(string className, string title, uint style, uint exStyle,
            int x, int y, int width, int height, IntPtr parent)
            => BrowserWindowSurface.Create(title, x, y, width, height, (exStyle & 0x80000) != 0);
    }
}
