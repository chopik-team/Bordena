; Installation is serialized. Silent updates never kill a running Bordena.
Var BordenaInstallMutex
!macroundef CheckIfAppIsRunning
!macro CheckIfAppIsRunning executablePath productName
  !insertmacro RestartManager_StartSession $R0
  ${If} $R0 == ""
    SetErrorLevel 1603
    Abort "Cannot check running applications."
  ${EndIf}
  !insertmacro RestartManager_RegisterFile $R0 "${executablePath}"
  ${If} $0 != 0
    !insertmacro RestartManager_EndSession $R0
    SetErrorLevel 1603
    Abort "Cannot check the installed executable."
  ${EndIf}
  System::Call 'RSTRTMGR::RmGetList(p R0, *i .r1, *i .r2, p 0, *i .r3) i .r0'
  StrCpy $R4 $0
  !insertmacro RestartManager_EndSession $R0
  ${If} $R4 != 0
    SetErrorLevel 1618
    Abort "Close ${productName} and retry. Your projects have not been changed."
  ${EndIf}
!macroend
!macro NSIS_HOOK_PREINSTALL
  System::Call 'kernel32::CreateMutexW(p 0, i 0, w "Local\${BUNDLEID}.installer") p.r0 ?e'
  Pop $1
  StrCpy $BordenaInstallMutex $0
  ${If} $1 = 183
    SetErrorLevel 1618
    Abort "Another installation is already in progress."
  ${EndIf}
!macroend
!macro NSIS_HOOK_POSTINSTALL
  WriteRegStr HKCU "Software\CHOPIK\Applications\${BUNDLEID}" "InstallPath" "$INSTDIR"
  WriteRegStr HKCU "Software\CHOPIK\Applications\${BUNDLEID}" "Version" "${VERSION}"
  WriteRegStr HKCU "Software\CHOPIK\Applications\${BUNDLEID}" "Channel" "stable"
  WriteRegStr HKCU "Software\CHOPIK\Applications\${BUNDLEID}" "ProductId" "${BUNDLEID}"
!macroend
!macro NSIS_HOOK_POSTUNINSTALL
  ReadRegStr $0 HKCU "Software\CHOPIK\Applications\${BUNDLEID}" "InstallPath"
  ${If} $0 == $INSTDIR
    DeleteRegKey HKCU "Software\CHOPIK\Applications\${BUNDLEID}"
  ${EndIf}
!macroend
