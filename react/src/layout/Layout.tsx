import React from 'react';
import type { ReactNode } from 'react';
import styles from './Layout.module.scss';
import Header from '../components/layout/Header/Header';
import Sidebar from '../components/layout/Sidebar/Sidebar';

interface LayoutProps { children: ReactNode; }

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className={styles.root}>
      <Header />
      <div className={styles.body}>
        <Sidebar />
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
};

export default Layout;