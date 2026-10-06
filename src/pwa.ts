import { useCallback, useEffect, useRef, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export type InstallResult = 'accepted' | 'dismissed' | 'unavailable'

export interface PwaInstallState {
  canInstall: boolean
  isIOS: boolean
  isMobile: boolean
  isStandalone: boolean
  install: () => Promise<InstallResult>
}

function displayModeStandalone(): boolean {
  if (typeof window === 'undefined') return false

  const standaloneNavigator = (navigator as Navigator & { standalone?: boolean })
    .standalone
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    standaloneNavigator === true
  )
}

function iosDevice(): boolean {
  if (typeof navigator === 'undefined') return false

  return (
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

function mobileDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false

  return (
    iosDevice() ||
    /Android/i.test(navigator.userAgent) ||
    window.matchMedia('(pointer: coarse)').matches ||
    window.matchMedia('(max-width: 600px)').matches
  )
}

/**
 * Stav instalace PWA.
 *
 * Android může dodat nativní instalační prompt, iOS ho z bezpečnostních důvodů
 * nemá. Mobilní fallback proto nechává aplikaci zobrazit krátký návod.
 */
export function usePwaInstall(): PwaInstallState {
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null)
  const [canInstall, setCanInstall] = useState(false)
  const [isStandalone, setIsStandalone] = useState(displayModeStandalone)
  const [isMobile, setIsMobile] = useState(mobileDevice)
  const isIOS = iosDevice()

  useEffect(() => {
    const updateViewportState = () => {
      setIsStandalone(displayModeStandalone())
      setIsMobile(mobileDevice())
    }
    const media = window.matchMedia('(display-mode: standalone)')
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      deferredPrompt.current = event as BeforeInstallPromptEvent
      setCanInstall(true)
    }
    const onAppInstalled = () => {
      deferredPrompt.current = null
      setCanInstall(false)
      updateViewportState()
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)
    window.addEventListener('resize', updateViewportState)
    if (media.addEventListener) media.addEventListener('change', updateViewportState)
    else media.addListener(updateViewportState)
    updateViewportState()

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
      window.removeEventListener('resize', updateViewportState)
      if (media.removeEventListener)
        media.removeEventListener('change', updateViewportState)
      else media.removeListener(updateViewportState)
    }
  }, [])

  const install = useCallback(async (): Promise<InstallResult> => {
    const prompt = deferredPrompt.current
    if (!prompt) return 'unavailable'

    await prompt.prompt()
    const choice = await prompt.userChoice
    deferredPrompt.current = null
    setCanInstall(false)
    return choice.outcome
  }, [])

  return { canInstall, isIOS, isMobile, isStandalone, install }
}
