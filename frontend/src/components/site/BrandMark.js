const BrandMark = ({ compact = false }) => (
  <span className='site-brand' aria-label='PrivateVoting'>
    <img 
      src='/logo512.png' 
      alt='PrivateVoting Logo' 
      className='site-brand__logo-image'
      width='44'
      height='44'
    />
    {!compact ? (
      <span className='site-brand__copy'>
        <span className='site-brand__name'>PrivateVoting</span>
        <span className='site-brand__tag'>Secure digital elections</span>
      </span>
    ) : null}
  </span>
);

export default BrandMark;
