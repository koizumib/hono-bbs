// NGワードフィルタで何件が非表示になっているかを示す小さな注意書き。
// フィルタが「静かに」効いて件数だけ減るのを防ぎ、設定タブへの導線も兼ねる。
export default function NgHiddenNotice({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <div className="px-3 py-1.5 text-[11px] text-slate-500 bg-slate-100/50 dark:bg-slate-800/30 border-b border-c-border flex items-center gap-1.5 flex-shrink-0">
      <span className="material-symbols-outlined text-[13px]">visibility_off</span>
      NGワードにより{count}件非表示
    </div>
  )
}
