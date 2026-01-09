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
            const minute = parseInt(match[1] || '0')
            const second = parseInt(match[2] || '0')
            const msStr = match[3] || '0'
            const millisecond = parseInt(msStr.length === 2 ? msStr + '0' : msStr)
            const time = minute * 60 + second + millisecond / 1000
            const text = line.replace(timeReg, '').trim()

            if (text) {
                result.push({ time, text })
            }
        }
    }

    return result
}
