import React from 'react';

const SkeletonCard: React.FC = () => {
  return (
    <div className="skeleton-card">
      <div className="badge-container">
        <div className="skeleton skeleton-badge"></div>
        <div className="skeleton skeleton-badge" style={{ width: '60px' }}></div>
      </div>
      <div className="skeleton skeleton-title"></div>
      <div className="skeleton skeleton-text"></div>
      <div className="skeleton skeleton-text short"></div>
      <div className="skeleton skeleton-button"></div>
    </div>
  );
};

export default SkeletonCard;