Section "Uninstall"
  ; Remove Registry Keys
  DeleteRegKey HKCU "Software\RetailManager"
  
  ; Remove AppData local and roaming folders
  RMDir /r "$LOCALAPPDATA\retail-manager"
  RMDir /r "$LOCALAPPDATA\com.retailmanager.app"
  RMDir /r "$LOCALAPPDATA\retail-manager-logs"
  RMDir /r "$APPDATA\retail-manager"
  
  ; Note: $INSTDIR is handled by Tauri automatically
SectionEnd
