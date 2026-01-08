<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useMusicStore } from '@/stores/music'
import { parseLrc, type LrcLine } from '@/utils/lrc'

const musicStore = useMusicStore()
defineProps<{
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
        musicStore.fetchLyrics(newSong)
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
}

const onNext = () => {
    musicStore.playNext()
}

</script>

<template>
    <div class="full-player">
        <!-- Background Blur -->
        <div class="bg-blur" :style="{ backgroundImage: `url(${musicStore.currentSong?.cover})` }"></div>
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
                <div class="spacer"></div>
            </div>

            <!-- Main Area -->
            <div class="main-area" @click="showLyrics = !showLyrics">
                 <!-- Vinyl Mode -->
                 <div class="vinyl-wrapper" v-show="!showLyrics">
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
                         :class="{ active: index === currentLineIndex }"
                         @click="seekToLine(line)"
                       >
                           {{ line.text }}
                       </div>
                 </div>
            </div>

            <!-- Controls -->
            <div class="controls-area">
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
</style>
