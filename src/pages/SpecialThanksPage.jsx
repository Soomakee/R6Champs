const FRIENDS = [
  {
    name: 'Thugqn',
    url: 'https://www.tiktok.com/@axhtian',
    platform: 'TikTok',
  },
  {
    name: 'Phem',
    url: 'https://www.tiktok.com/@thepheminist',
    platform: 'TikTok',
  },
  {
    name: 'LittleLordSissy',
    url: 'https://linktr.ee/littlelordsissy',
    platform: 'Linktree',
  },
]

export default function SpecialThanksPage() {
  return (
    <section className="section">
      <div className="section-head">
        <p className="eyebrow">The Squad</p>
        <h1>Special Thanks</h1>
        <p className="lede">
          R6Champs is built with the boys. Show them some love.
        </p>
      </div>
      <div className="thanks-grid">
        {FRIENDS.map((friend) => (
          <a
            key={friend.name}
            href={friend.url}
            target="_blank"
            rel="noopener noreferrer"
            className="thanks-card"
          >
            <span className="thanks-role">{friend.platform}</span>
            <h2>{friend.name}</h2>
            <span className="thanks-link">
              {friend.url.replace(/^https?:\/\/(www\.)?/, '')} ↗
            </span>
          </a>
        ))}
      </div>
    </section>
  )
}
