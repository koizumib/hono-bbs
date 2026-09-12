interface SwipeHintOverlayProps {
  label: string | null
}

// スワイプでの画面遷移ジェスチャー中、指を離すとどちらへ遷移するかを
// 画面中央に表示するための薄いオーバーレイ。ジェスチャー中は画面自体は動かさない。
export default function SwipeHintOverlay({ label }: SwipeHintOverlayProps) {
  if (!label) return null
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
      <div className="px-6 py-3 rounded-2xl bg-black/70 text-white text-base font-bold shadow-xl backdrop-blur-sm">
        {label}
      </div>
    </div>
  )
}
