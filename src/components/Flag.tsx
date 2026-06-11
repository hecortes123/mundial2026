import { getFlagUrl } from '@/lib/teamFlags'

interface Props {
  code: string | null | undefined
  size?: number
}

export default function Flag({ code, size = 32 }: Props) {
  if (!code) {
    return (
      <div
        style={{
          width: `${size * 1.4}px`,
          height: `${size}px`,
          background: 'var(--bg-elevated)',
          borderRadius: '4px',
          border: '1px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>?</span>
      </div>
    )
  }

  const url = getFlagUrl(code)

  return (
    <img
      src={url}
      alt={code}
      width={size * 1.4}
      height={size}
      style={{
        width: `${size * 1.4}px`,
        height: `${size}px`,
        objectFit: 'cover',
        borderRadius: '4px',
        border: '1px solid var(--border-default)',
        display: 'block',
      }}
    />
  )
}