
// Home.tsx
import React from 'react';
import styles from './Home.module.scss';

import talkToDocumentImg from '../../assets/talk-to-document.svg';
import talkToDataImg from '../../assets/talk-to-data.svg';
import auditImg from '../../assets/audit.svg';
import lineageGraphImg from '../../assets/lineage-graph.svg'; // ✅ add this file

import Card from '../../components/ui/Card/Card';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';

const Home: React.FC = () => {
  const navigate = useNavigate();
  
  const { currentRole,
    effectivePermissions,setMode } = useAppContext();
console.log('Current Role in Home:', currentRole);
console.log('Effective Permissions in Home:', effectivePermissions);
  const cardData = [
    {
      id: 'talk-to-document',
      title: 'Talk to Document',
      description: 'Conversation AI bot for unstructured data',
      image: talkToDocumentImg,
      route: '/application',
    },
    {
      id: 'talk-to-data',
      title: 'Talk to Data',
      description: 'Conversation AI bot for structured data',
      image: talkToDataImg,
      route: '/application',
    },
    {
      id: 'regulatory-audit-compliance',
      title: 'Regulatory Audit Compliance',
      description: 'Following the rules and proving it with evidence.',
      image: auditImg,
      route: '/regulatory-audit-compliance',
    }, 
    {   
      id: 'lineage-graph',
      title: 'Lineage Graph',
      permissionKey: 'Lineage Graph',
      description: 'Visualize lineage and dependencies',
      image: lineageGraphImg,
      route: '/lineage-graph', // ✅ placeholder route for now
    },
  ];


  const allowedCards = cardData.filter((card) => {
    return Boolean(effectivePermissions[(card as any).permissionKey || card.title]);
  });
  
  const handleCardClick = (route: string, id: string) => {
    if (id === 'talk-to-document') {
      setMode('TalkToDocument');
    } else if (id === 'talk-to-data') {
      setMode('TalkToData');
    }
    // ✅ no setMode for lineage-graph now
    navigate(route);
  };


  return (
    <div className={styles.wrapper}>
      <h3 className={styles.wrappertitle}>Home</h3>

      <div className={styles.homemain}>
        <div className={styles.header}>
          <h2 className={styles.title}>Welcome to AI Scalability Platform</h2>
          <p className={styles.tagline}>
            From idea to AI - design, test, and deploy on a single platform.
          </p>
        </div>

        <div className={styles.cards}>
          {allowedCards.map((card) => (
            <Card
              key={card.id}
              title={card.title}
              description={card.description}
              image={card.image}
              onClick={() => handleCardClick(card.route, card.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Home;
