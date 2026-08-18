import React from 'react';
import { FaChartBar } from 'react-icons/fa';
import WorkspaceSection from './WorkspaceSection';

const Results = (props) => (
  <WorkspaceSection {...props} title='Results' description='Open an event to view its verified voting results and analytics.' icon={<FaChartBar />} actionLabel='Choose an event' actionPath='/voting-events' />
);

export default Results;
