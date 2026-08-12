const BrandMark = ({ compact = false }) => (
  <span className='site-brand' aria-label='PrivateVoting'>
    <span className='site-brand__mark' aria-hidden='true'>
      PV
    </span>
    {!compact ? (
      <span className='site-brand__copy'>
        <span className='site-brand__name'>PrivateVoting</span>
        <span className='site-brand__tag'>Secure digital elections</span>
      </span>
    ) : null}
  </span>
);

export default BrandMark;
