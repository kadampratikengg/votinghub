import React from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import './Workspace.css';

const WorkspaceSection = ({
  setIsAuthenticated,
  eyebrow = 'Election workspace',
  title,
  description,
  icon,
  actionLabel,
  actionPath = '/manage',
}) => {
  const navigate = useNavigate();

  return (
    <div className='work-shell'>
      <Sidebar setIsAuthenticated={setIsAuthenticated} />
      <main className='work-page'>
        <section className='work-hero work-hero--manage'>
          <div>
            <span className='work-kicker'>{eyebrow}</span>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
        </section>
        <section className='work-panel work-section-empty'>
          <span className='work-section-empty__icon'>{icon}</span>
          <div>
            <h2>{title}</h2>
            <p>{description}</p>
            {actionLabel && (
              <button
                className='work-button work-button--primary'
                onClick={() => navigate(actionPath)}
              >
                {actionLabel}
              </button>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default WorkspaceSection;
