using System;
using System.Collections.Generic;
using UnityEngine;
using Windows.Win32.Foundation;

namespace TechC.VBattle.Core.Window
{
    // Draw only within the game's canvas; never open browser or OS windows.
    public sealed class BrowserWindowSurface : MonoBehaviour
    {
        public sealed class Item
        {
            public RECT Bounds;
            public bool Visible;
            public bool Frameless;
            public string Title;
            public Texture2D Texture;
        }
        private static readonly Dictionary<IntPtr, Item> windows = new Dictionary<IntPtr, Item>();
        private static BrowserWindowSurface instance;
        private static int nextId;
        public static Item Find(IntPtr id) => windows.TryGetValue(id, out var item) ? item : null;
        public static bool Remove(IntPtr id) => windows.Remove(id);
        public static void Clear() => windows.Clear();
        public static IntPtr Create(string title, int x, int y, int width, int height, bool frameless)
        {
            if (instance == null)
            {
                instance = new GameObject("BrowserWindowSurface").AddComponent<BrowserWindowSurface>();
                DontDestroyOnLoad(instance.gameObject);
            }
            var id = new IntPtr(++nextId);
            windows.Add(id, new Item { Title = title, Frameless = frameless,
                Bounds = new RECT { left = x, top = y, right = x + width, bottom = y + height } });
            return id;
        }
        private void OnGUI()
        {
            if (Event.current.type != EventType.Repaint) return;
            GUI.depth = -100;
            foreach (var pair in windows)
            {
                var item = pair.Value;
                var bounds = item.Bounds;
                if (!item.Visible || bounds.Width <= 0 || bounds.Height <= 0) continue;
                var rect = new Rect(bounds.left, bounds.top, bounds.Width, bounds.Height);
                if (!item.Frameless)
                {
                    GUI.Box(rect, GUIContent.none);
                    if (item.Texture == null) GUI.Label(new Rect(rect.x + 6, rect.y + 2, rect.width - 12, 22), item.Title);
                }
                if (item.Texture != null) GUI.DrawTexture(rect, item.Texture, ScaleMode.StretchToFill, true);
                else if (WindowRegistry.ByHwnd.TryGetValue(pair.Key, out var window) && window is BasicWindow basic)
                {
                    var style = new GUIStyle(GUI.skin.label) { fontSize = basic.FontSize, wordWrap = true };
                    GUI.Label(new Rect(rect.x + basic.TextX, rect.y + basic.TextY, rect.width, rect.height), basic.DisplayText, style);
                }
            }
        }
        private void OnDestroy() { windows.Clear(); instance = null; }
    }
}
