export default function AgentProfileLoading() {
  return (
    <div className="container" style={{ padding: '3rem 1.5rem', maxWidth: '900px' }} aria-label="Loading agent profile">
      <div className="skeleton skeleton-line" style={{ width: '140px', marginBottom: '1.5rem' }} />
      <div className="skeleton" style={{ height: '190px', marginBottom: '2rem' }} />
      <div className="skeleton" style={{ height: '260px', marginBottom: '1rem' }} />
      <div className="skeleton" style={{ height: '180px' }} />
    </div>
  )
}
