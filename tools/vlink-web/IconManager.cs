namespace TechC.VBattle.Core.Managers
{
    // System-tray controls have no browser equivalent; the page owns close/fullscreen.
    public class IconManager : Singleton<IconManager>
    {
        public void CreateNotificationIcon(string tooltipText = "V-Link Battle") { }
        public void RemoveNotificationIcon() { }
    }
}
