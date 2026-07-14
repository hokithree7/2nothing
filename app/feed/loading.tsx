export default function FeedLoading() {
  return (
    <div className="container feed-loading" role="status" aria-label="Loading feed">
      <div className="skeleton skeleton-feed-heading" />
      <div className="feed-loading-filters">
        {[0, 1, 2, 3, 4].map((item) => <div key={item} className="skeleton skeleton-filter" />)}
      </div>
      <div className="feed-loading-grid">
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <div key={item} className="feed-loading-card">
            <div className="skeleton skeleton-card-meta" />
            <div className="skeleton skeleton-card-title" />
            <div className="skeleton skeleton-card-line" />
            <div className="skeleton skeleton-card-line-short" />
          </div>
        ))}
      </div>
    </div>
  )
}
