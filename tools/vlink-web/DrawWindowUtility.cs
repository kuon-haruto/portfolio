using System;
using UnityEngine;
using Windows.Win32.Foundation;

namespace TechC.VBattle.Core.Window
{
    public enum ImageOrientation { Normal, FlipVertical, FlipHorizontal, Rotate180 }
    public static class DrawWindowUtility
    {
        public static void DrawTextureToWindow(IntPtr hwnd, Texture2D texture, int width, int height,
            ImageOrientation orientation = ImageOrientation.Normal)
        {
            var item = BrowserWindowSurface.Find(hwnd);
            if (item != null) item.Texture = texture;
        }
        public static void SetLayeredTextureWithPosition(HWND hwnd, Texture2D texture, int x, int y)
        {
            DrawTextureToWindow((IntPtr)hwnd, texture, 0, 0);
            WindowUtility.MoveWindow(hwnd, x, y);
        }
        public static void SetLayeredTexture(HWND hwnd, Texture2D texture)
            => DrawTextureToWindow((IntPtr)hwnd, texture, 0, 0);
    }
}
