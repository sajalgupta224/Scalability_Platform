import React from 'react';
import styles from './SamplePage.module.scss';

const SamplePage: React.FC = () => {

    return (
        <div className={styles.container}>
            {/* Add your content here */}
            SamplePage
            <p>This is the Sample Page content.</p>
        </div>
    );
};

export default SamplePage;