using System;
using UnityEngine;
using Windows.Win32.Foundation;

namespace TechC.VBattle.Core.Window
{
    public class WebWindow : NativeWindow
    {
        public string Url { get; private set; }
        public HWND WebWindowHwnd => (HWND)Hwnd;
        public WebWindow(IntPtr hwnd, int width, int height, MonoBehaviour mono, string url)
            : base(hwnd, width, height, WindowFactory.WindowType.Web) { SetUrl(url); }
        public void Move() { }
        public void SetUrl(string url = null, HtmlNames.HtmlFileName? htmlFile = null)
        {
            Url = url;
            var item = BrowserWindowSurface.Find(Hwnd);
            if (item != null) item.Title = htmlFile?.ToString() ?? "V-Link";
        }
    }
}
