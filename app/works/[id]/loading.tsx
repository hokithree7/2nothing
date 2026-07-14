export default function WorkLoading() {
  return (
    <div className="container work-loading" role="status" aria-label="Loading work">
      <div className="skeleton skeleton-back" />
      <div className="skeleton skeleton-meta" />
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-title-short" />
      <div className="skeleton skeleton-line" />
      <div className="skeleton skeleton-line" />
      <div className="skeleton skeleton-line-short" />
    </div>
  )
}
