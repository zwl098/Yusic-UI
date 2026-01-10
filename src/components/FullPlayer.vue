<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useMusicStore } from '@/stores/music'
import { useRoomStore } from '@/stores/room'
import { parseLrc, type LrcLine } from '@/utils/lrc'

const musicStore = useMusicStore()
const roomStore = useRoomStore()
const props = defineProps<{
  show: boolean
}>()
defineEmits(['close'])

const showLyrics = ref(false)
const lyrics = ref<LrcLine[]>([])
const currentLineIndex = ref(0)
const lyricsContainer = ref<HTMLElement | null>(null)

// Parse lyrics when song or lyrics change
watch(() => musicStore.currentSong, (newSong) => {
    console.log(newSong)
    if (!newSong) {
        lyrics.value = []
        return
    }

    if (newSong.lrc) {
        lyrics.value = parseLrc(newSong.lrc)
    } else {
        lyrics.value = []
        // Trigger fetch if missing
        // musicStore.fetchLyrics(newSong) // Logic moved to music.ts playSong
    }
    currentLineIndex.value = 0
}, { immediate: true, deep: true })

// Formatting time
const formatTime = (time: number) => {
    const min = Math.floor(time / 60)
    const sec = Math.floor(time % 60)
    return `${min}:${sec.toString().padStart(2, '0')}`
}

// Progress and seeking
const progress = computed({
    get: () => (musicStore.currentTime / musicStore.duration) * 100,
    set: (val) => {
        const time = (val / 100) * musicStore.duration
        musicStore.seek(time)
        roomStore.emitSeek(time)
    }
})

// Sync lyrics
watch(() => musicStore.currentTime, (time) => {
    if (!showLyrics.value) return
    
    // Find current line
    const index = lyrics.value.findIndex((line, i) => {
        const nextLine = lyrics.value[i + 1]
        return time >= line.time && (!nextLine || time < nextLine.time)
    })
    
    if (index !== -1 && index !== currentLineIndex.value) {
        currentLineIndex.value = index
        scrollToCurrentLine()
    }
})

const seekToLine = (line: LrcLine) => {
    musicStore.seek(line.time)
    roomStore.emitSeek(line.time)
    if (!musicStore.isPlaying) {
        musicStore.togglePlay()
    }
}

const scrollToCurrentLine = () => {
    nextTick(() => {
        if (!lyricsContainer.value) return
        const activeLine = lyricsContainer.value.querySelector('.lrc-line.active') as HTMLElement
        if (activeLine) {
             lyricsContainer.value.scrollTo({
                 top: activeLine.offsetTop - lyricsContainer.value.clientHeight / 2 + activeLine.clientHeight / 2,
                 behavior: 'smooth'
             })
        }
    })
}

const togglePlay = () => {
    musicStore.togglePlay()
}

const onPrev = () => {
    // Implement prev logic if queue supports history, or just restart
    // For now, simplicity: restart song or do nothing
    musicStore.seek(0)
    roomStore.emitSeek(0)
}

const onNext = () => {
    musicStore.playNext()
}

// Emotes
const emojis = ['❤️', '🔥', '😂', '🎵', '🕺', '👋']
const emoteContainer = ref<HTMLElement | null>(null)

const sendEmote = (emoji: string) => {
    roomStore.emitEmote(emoji)
}

watch(() => roomStore.lastEmote, (val) => {
    if (val && val.emoji) {
        showEmoteAnimation(val.emoji)
    }
})

const showEmoteAnimation = (emoji: string) => {
    if (!emoteContainer.value) return

    const el = document.createElement('div')
    el.innerText = emoji
    el.className = 'floating-emoji'
    el.style.left = Math.random() * 80 + 10 + '%' // Random horizontal pos
    emoteContainer.value.appendChild(el)

    // Remove after animation
    setTimeout(() => {
        el.remove()
    }, 3000)
}

// Visualizer
const bgScale = ref(1.2)
let dataArray: Uint8Array | null = null
let animationId: number | null = null

const startLoop = () => {
    if (!props.show) return // Don't run if hidden
    const analyser = musicStore.analyser
    if (!analyser) return

    if (!dataArray) {
        dataArray = new Uint8Array(analyser.frequencyBinCount)
    }
    
    // Fix: Explicit access or confirming type compatibility if needed, 
    // but in browser env Uint8Array should be fine. 
    // The previous error was about SharedArrayBuffer vs ArrayBuffer incompatibility in strict types.
    // Casting 'dataArray' simply works for getByteFrequencyData
    analyser.getByteFrequencyData(dataArray as any)
    
    // Calculate Bass (first ~10 bins)
    let sum = 0
    // Access check
    if (dataArray && dataArray.length >= 10) {
        const arr = dataArray
        for (let i = 0; i < 10; i++) {
            const val = arr[i]
            if (val !== undefined) {
                sum += val
            }
        }
    }
    const average = sum / 10
    
    // Smooth transition
    // Scale: 1.2 (base) + energy benefit
    const targetScale = 1.2 + (average / 255) * 0.15
    bgScale.value += (targetScale - bgScale.value) * 0.2 // Ease
    
    animationId = requestAnimationFrame(startLoop)
}

watch(() => props.show, (val) => {
    if (val) {
        startLoop()
    } else {
        if (animationId) cancelAnimationFrame(animationId)
    }
})

onMounted(() => {
    if (props.show && musicStore.analyser) {
        startLoop()
    }
})

watch(() => musicStore.analyser, (newVal) => {
    if (newVal && props.show) {
        startLoop()
    }
})

onUnmounted(() => {
    if (animationId) cancelAnimationFrame(animationId)
    // Close PiP on unmount
    if (pipWindow.value) {
        pipWindow.value.close()
    }
})

// PiP Logic
const isPipSupported = 'documentPictureInPicture' in window
const pipTarget = ref<HTMLElement | null>(null)
const pipWindow = ref<any>(null)

const togglePip = async () => {
    if (pipWindow.value) {
        pipWindow.value.close()
        return
    }

    try {
        // @ts-ignore
        const pip = await window.documentPictureInPicture.requestWindow({
            width: 400,
            height: 150
        })
        
        pipWindow.value = pip

        // Copy styles
        Array.from(document.styleSheets).forEach((styleSheet) => {
            try {
                if (styleSheet.href) {
                     const link = document.createElement('link')
                     link.rel = 'stylesheet'
                     link.type = 'text/css'
                     link.href = styleSheet.href
                     pip.document.head.appendChild(link)
                } else if (styleSheet.cssRules) {
                     const style = document.createElement('style')
                     Array.from(styleSheet.cssRules).forEach(rule => {
                         style.appendChild(document.createTextNode(rule.cssText))
                     })
                     pip.document.head.appendChild(style)
                }
            } catch (e) {
                console.warn(e)
            }
        })

        // Create container, but manual style injection for scope might be needed
        // For simplicity, we inject a root div
        const root = pip.document.createElement('div')
        root.id = 'pip-root'
        root.style.height = '100%'
        pip.document.body.appendChild(root)
        pip.document.body.style.margin = '0'
        
        pipTarget.value = root

        pip.addEventListener('pagehide', () => {
            pipTarget.value = null
            pipWindow.value = null
        })

    } catch (e) {
        console.error('Failed to open PiP:', e)
    }
}
</script>

<template>
    <div class="full-player">
        <!-- Background Blur -->
        <div 
            class="bg-blur" 
            :style="{ 
                backgroundImage: `url(${musicStore.currentSong?.cover})`,
                transform: `scale(${bgScale})`
            }"
        ></div>
        <div class="bg-mask"></div>

        <!-- content -->
        <div class="content">
            <!-- Header -->
            <div class="header">
                <van-icon name="arrow-down" size="24" color="white" @click="$emit('close')" />
                <div class="header-info">
                    <div class="title">{{ musicStore.currentSong?.name }}</div>
                    <div class="artist">{{ musicStore.currentSong?.artist }}</div>
                </div>
                <div class="actions">
                    <van-icon 
                        name="desktop-o" 
                        size="24" 
                        color="white" 
                        @click="togglePip" 
                        v-if="isPipSupported"
                        style="margin-right: 16px;" 
                    />
                    <div class="spacer" v-else></div>
                </div>
            </div>

            <!-- PiP Content (Teleported) -->
            <Teleport :to="pipTarget" v-if="pipTarget">
                <div class="pip-container" @click="togglePlay">
                    <div class="pip-bg" :style="{ backgroundImage: `url(${musicStore.currentSong?.cover})` }"></div>
                    <div class="pip-mask"></div>
                    <div class="pip-content">
                        <div class="pip-line active">
                            {{ lyrics[currentLineIndex]?.text || 'No Lyrics' }}
                        </div>
                        <div class="pip-line next" v-if="lyrics[currentLineIndex + 1]">
                            {{ lyrics[currentLineIndex + 1]?.text }}
                        </div>
                    </div>
                </div>
            </Teleport>


            <!-- Main Area -->
            <div class="main-area" @click="showLyrics = !showLyrics">
                 <!-- Vinyl Mode -->
                 <div class="vinyl-wrapper" v-show="!showLyrics">
                      <div class="stylus" :class="{ playing: musicStore.isPlaying }"></div>
                      <div class="vinyl-disc" :class="{ rotating: musicStore.isPlaying }">
                          <img :src="musicStore.currentSong?.cover || 'https://via.placeholder.com/300'" class="cover-img" />
                      </div>
                 </div>

                 <!-- Lyrics Mode -->
                 <div class="lyrics-wrapper" v-show="showLyrics" ref="lyricsContainer">
                      <div v-if="lyrics.length === 0" class="no-lyrics">No Lyrics</div>
                      <div 
                        v-else
                         v-for="(line, index) in lyrics" 
                         :key="index" 
                         class="lrc-line"
                         :class="{ active: index === currentLineIndex, interlude: line.isInterlude }"
                       >
                           <span class="lrc-text">{{ line.text }}</span>
                           <van-icon 
                                name="play-circle-o" 
                                class="lrc-play-icon" 
                                @click.stop="seekToLine(line)" 
                           />
                       </div>
                 </div>
            </div>

            <!-- Controls -->
            <div class="controls-area">
                 <!-- Emote Bar -->
                 <div class="emote-bar" v-if="roomStore.roomId">
                      <div 
                        v-for="emoji in emojis" 
                        :key="emoji" 
                        class="emote-btn"
                        @click="sendEmote(emoji)"
                      >
                          {{ emoji }}
                      </div>
                 </div>

                 <!-- Progress Bar -->
                 <div class="progress-bar">
                      <span class="time-text">{{ formatTime(musicStore.currentTime) }}</span>
                      <van-slider v-model="progress" bar-height="4px" button-size="12px" active-color="#fff" inactive-color="rgba(255,255,255,0.3)" />
                      <span class="time-text">{{ formatTime(musicStore.duration) }}</span>
                 </div>

                 <!-- Buttons -->
                 <div class="buttons">
                      <van-icon name="arrow-left" size="28" color="white" @click.stop="onPrev" />
                      <div class="play-btn" @click.stop="togglePlay">
                          <van-icon :name="musicStore.isPlaying ? 'pause' : 'play'" size="40" color="#333" />
                      </div>
                      <van-icon name="arrow" size="28" color="white" @click.stop="onNext" />
                 </div>
            </div>
        </div>
        
        <!-- Floating Emotes Container -->
        <div class="floating-emotes" ref="emoteContainer"></div>
    </div>
</template>

<style scoped>
.full-player {
    position: relative;
    height: 100%;
    width: 100%;
    overflow: hidden;
    color: white;
    display: flex;
    flex-direction: column;
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
}

.bg-blur {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-size: cover;
    background-position: center;
    filter: blur(40px);
    transform: scale(1.2);
    z-index: 0;
    will-change: transform;
    transition: transform 0.1s linear; /* Smoother visualizer updates */
}

.bg-mask {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    z-index: 1;
}

.content {
    position: relative;
    z-index: 2;
    height: 100%;
    display: flex;
    flex-direction: column;
}

.header {
    padding: 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.header-info {
    text-align: center;
}

.title {
    font-size: 18px;
    font-weight: 600;
}

.artist {
    font-size: 14px;
    opacity: 0.7;
}

.spacer {
    width: 24px;
}

.main-area {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    position: relative;
}

/* Vinyl Styles */
.vinyl-wrapper {
    width: 300px;
    height: 300px;
    border-radius: 50%;
    background: #111;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 20px rgba(0,0,0,0.5);
}

.vinyl-disc {
    width: 280px;
    height: 280px;
    border-radius: 50%;
    overflow: hidden;
    animation-play-state: paused;
}

.vinyl-disc.rotating {
    animation: rotate 20s linear infinite;
}

.cover-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

@keyframes rotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

/* Lyrics Styles */
.lyrics-wrapper {
    width: 100%;
    height: 100%;
    overflow-y: auto;
    padding: 20px 0;
    text-align: center;
    mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%);
    -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%);
    -webkit-overflow-scrolling: touch;
    scroll-behavior: smooth;
}

.lrc-line {
    padding: 12px 16px;
    opacity: 0.4;
    transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    font-size: 18px;
    min-height: 28px;
    cursor: pointer;
    transform-origin: center;
    display: flex;
    align-items: center;
    justify-content: space-between;
    text-align: left; /* Align text to left for better reading with icon on right */
}

.lrc-text {
    flex: 1;
    text-align: center; /* Keep center text if preferred, but flex complicates it. Let's try keeping it simple */
}

.lrc-play-icon {
    font-size: 24px;
    padding: 10px;
    opacity: 0.2;
    transition: all 0.2s;
    cursor: pointer;
}

.lrc-play-icon:hover {
    opacity: 1;
    transform: scale(1.1);
}

/* On mobile touch devices, maybe always show a bit clearer? Or keep 0.2 is fine */
.lrc-line.active .lrc-play-icon {
    opacity: 0.8;
}

.lrc-line:hover {
    opacity: 0.7;
}

.lrc-line.active {
    opacity: 1;
    font-size: 24px;
    color: #fff;
    font-weight: 700;
    transform: scale(1.05);
    text-shadow: 0 0 20px rgba(255, 255, 255, 0.5);
}

.lrc-line.interlude {
    font-family: 'Georgia', serif;
    font-size: 16px;
    font-style: italic;
    opacity: 0.8;
    color: #ffd700;
}

.no-lyrics {
    margin-top: 50%;
    opacity: 0.5;
}

/* Controls Styles */
.controls-area {
    padding: 30px 24px 50px;
}

.progress-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 30px;
}

.time-text {
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    width: 40px;
    text-align: center;
}

.buttons {
    display: flex;
    align-items: center;
    justify-content: space-around;
}

.play-btn {
    width: 64px;
    height: 64px;
    background: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
}

/* Emotes */
.emote-bar {
    display: flex;
    justify-content: center;
    gap: 16px;
    margin-bottom: 20px;
}

.emote-btn {
    font-size: 24px;
    cursor: pointer;
    transition: transform 0.1s;
    user-select: none;
}

.emote-btn:active {
    transform: scale(1.2);
}

.floating-emotes {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 10;
    overflow: hidden;
}

:deep(.floating-emoji) {
    position: absolute;
    bottom: 160px; /* Start above controls */
    font-size: 32px;
    animation: floatUp 3s ease-out forwards;
    opacity: 0;
}

@keyframes floatUp {
    0% {
        transform: translateY(0) scale(0.5);
        opacity: 0;
    }
    10% {
        opacity: 1;
        transform: translateY(-20px) scale(1.2);
    }
    100% {
        transform: translateY(-400px) scale(1);
        opacity: 0;
    }
}


/* PiP Styles (Global or deep because they are teleported) */
:deep(.pip-container) {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #121212;
    font-family: 'Inter', -apple-system, sans-serif;
    cursor: pointer; /* Click to play/pause */
    user-select: none;
}

:deep(.pip-bg) {
    position: absolute;
    width: 100%;
    height: 100%;
    background-size: cover;
    background-position: center;
    filter: blur(15px) brightness(0.4); /* Darker for better text contrast */
    z-index: 0;
    transform: scale(1.1); /* Prevent blur edges */
}

:deep(.pip-content) {
    position: relative;
    z-index: 10;
    text-align: center;
    color: white;
    width: 100%;
    padding: 0 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
}

:deep(.pip-line) {
    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
    line-height: 1.2;
    padding: 2px 0;
}

:deep(.pip-line.active) {
    font-size: 28px; /* Larger font */
    font-weight: 900;
    background: linear-gradient(to bottom, #fff 0%, #ddd 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    filter: drop-shadow(0 4px 6px rgba(0,0,0,0.5));
    margin-bottom: 4px;
    max-width: 95%;
}

:deep(.pip-line.next) {
    font-size: 14px;
    opacity: 0.6;
    letter-spacing: 0.5px;
    margin-bottom: 12px;
}


</style>
