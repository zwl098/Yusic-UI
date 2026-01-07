export interface LrcLine {
    time: number
    text: string
}

export function parseLrc(lrc: string | undefined): LrcLine[] {
    if (!lrc) return []

    const lines = lrc.split('\n')
    const result: LrcLine[] = []

    const timeReg = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/

    for (const line of lines) {
        const match = timeReg.exec(line)
        if (match) {
            const minute = parseInt(match[1])
            const second = parseInt(match[2])
            const millisecond = parseInt(match[3].length === 2 ? match[3] + '0' : match[3])
            const time = minute * 60 + second + millisecond / 1000
            const text = line.replace(timeReg, '').trim()

            if (text) {
                result.push({ time, text })
            }
        }
    }

    return result
}
