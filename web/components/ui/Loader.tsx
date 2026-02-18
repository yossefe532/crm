type Props = {
  className?: string
}

export const Loader = ({ className = "" }: Props) => {
  return (
    <div className={`loader ${className}`} aria-label="Loading" role="status">
      <div className="loader__bar" />
      <div className="loader__bar" />
      <div className="loader__bar" />
      <div className="loader__bar" />
      <div className="loader__bar" />
      <div className="loader__ball" />
    </div>
  )
}

