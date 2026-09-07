const TIP_URL = 'https://streamelements.com/imsaia/tip'

export default function DonatePage() {
  return (
    <section className="section">
      <div className="section-head">
        <p className="eyebrow">Keep it running</p>
        <h1>Donate</h1>
        <p className="lede">
          R6Champs is free and ad-free. Donations cover hosting and keep the
          map library growing.
        </p>
      </div>
      <div className="donate-card">
        <h2>Support R6Champs</h2>
        <p>
          Every contribution goes toward servers, new map strategies, and
          keeping the site fast and clean. No paywalls, ever.
        </p>
        <div className="donate-actions">
          <a
            className="btn btn--primary"
            href={TIP_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Donate via StreamElements ↗
          </a>
        </div>
        <p className="donate-note">
          Opens StreamElements in a new tab — every bit helps.
        </p>
      </div>
    </section>
  )
}
