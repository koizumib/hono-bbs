interface ToggleProps {
  checked: boolean
  onChange: (val: boolean) => void
}

export default function Toggle({ checked, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`w-11 h-6 rounded-full relative transition-all shadow-inner ${
        checked ? 'bg-c-accent' : 'bg-slate-700'
      }`}
    >
      <div
        className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
          checked ? 'right-1' : 'left-1'
        }`}
      />
    </button>
  )
}
