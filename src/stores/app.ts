import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
    const installPrompt = ref<any>(null)
    const showInstallButton = ref(false)

    const setInstallPrompt = (event: any) => {
        installPrompt.value = event
        showInstallButton.value = true
    }

    const installApp = async () => {
        if (!installPrompt.value) return

        installPrompt.value.prompt()
        const { outcome } = await installPrompt.value.userChoice
        console.log(`User response to the install prompt: ${outcome}`)

        installPrompt.value = null
        showInstallButton.value = false
    }

    return {
        installPrompt,
        showInstallButton,
        setInstallPrompt,
        installApp
    }
})
