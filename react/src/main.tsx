import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.scss';

const RootApp: React.FC = () => {
  return (<App/>);
};

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(<RootApp />);
