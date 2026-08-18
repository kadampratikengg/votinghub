import React from 'react';
import { FaVoteYea } from 'react-icons/fa';
import WorkspaceSection from './WorkspaceSection';

const Sessions = (props) => (
  <WorkspaceSection {...props} title='Voting Sessions' description='Configure election timing and monitor voting sessions from one place.' icon={<FaVoteYea />} actionLabel='Manage sessions' />
);

export default Sessions;
