const BrandMark = ({ compact = false }) => (
  <span className='site-brand' aria-label='PrivateVoting'>
    <picture>
      <source type='image/webp' srcSet='/logo-sm.webp' />
      <img 
        src='/logo-sm.png' 
        alt='PrivateVoting Logo' 
        className='site-brand__logo-image'
        width='44'
        height='44'
        loading='eager'
        decoding='async'
      />
    </picture>
    {!compact ? (
      <span className='site-brand__copy'>
        <span className='site-brand__name'>PrivateVoting</span>
        <span className='site-brand__tag'>Secure digital elections</span>
      </span>
    ) : null}
  </span>
);

export default BrandMark;
