import type { ElectronAPI } from '@electron-toolkit/preload'
import type { CompanionApi } from './index'

declare global {
  interface Window {
    electron: ElectronAPI
    api: CompanionApi
  }
}
