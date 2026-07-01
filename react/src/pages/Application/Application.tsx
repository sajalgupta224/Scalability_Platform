import React from "react";
import styles from "./Application.module.scss";
import Card from "../../components/ui/Card/Card";
import { useNavigate } from "react-router-dom";

import experimentAndDeployImg from "../../assets/experiment-and-deploy.svg";
import deployedApplicationImg from "../../assets/deployed-application.svg";
import dataPreparationImg from "../../assets/data-preparation.svg";
import semanticViewAgentImg from "../../assets/data-preparation.svg";

import { useAppContext } from "../../context/AppContext";

export const getModeDisplay = (mode: string) => {
  if (mode === "TalkToDocument") return "Talk to Document";
  if (mode === "TalkToData") return "Talk to Data";
  return "Application";
};

type CardItem = {
  title: string;
  description: string;
  image: string;
  route: string;
  permissionKey: string;
  parentKey: string;
};

const Application: React.FC = () => {
  const navigate = useNavigate();

  // ✅ Use effective permissions for preview support
  const { mode, effectivePermissions, loadingRole } = useAppContext();
  // const roleForCheck = effectiveRole || currentRole;

  const baseCards: CardItem[] = [
    {
      title: "Data Preparation",
      description: "Prepare your data for analysis",
      image: dataPreparationImg,
      route: "/data-preparation",
      permissionKey: "Data Preparation",
      parentKey: "Application",
    },
    {
      title: "Experiment and Deploy",
      description: "Experiment and deploy your models",
      image: experimentAndDeployImg,
      route: "/search-chatbot",
      permissionKey: "Experiment and Deploy",
      parentKey: "Application",
    },
    {
      title: "Deployed Applications",
      description: "Manage your deployed applications",
      image: deployedApplicationImg,
      route: "/deployed-application",
      permissionKey: "Deployed Applications",
      parentKey: "Application",
    },
  ];

  const semanticViewCard: CardItem = {
    title: "Semantic View Creation Agent",
    description: "Create semantic views using an agent",
    image: semanticViewAgentImg,
    route: "/semantic-view-agent",
    permissionKey: "Semantic View Creation Agent",
    parentKey: "Application",
  };

  const candidateCards: CardItem[] =
    mode === "TalkToData" ? [...baseCards, semanticViewCard] : baseCards;

  const allowedCards = candidateCards.filter((card) => {
    return Boolean(effectivePermissions[card.title]);
  });

  if (loadingRole) return null;

  return (
    <div className={styles.wrapper}>
      <h3 className={styles.wrappertitle}>Application</h3>
      <p className={styles.wrapperdesc}>{getModeDisplay(mode)}</p>

      <div className={styles.home}>
        <div
          className={`${styles.cards} ${
            mode === "TalkToDocument" ? styles.cardsDocument : styles.cardsData
          }`}
        >
          {allowedCards.length === 0 ? (
            <div style={{ padding: 20, opacity: 0.75 }}>
              You don’t have access to any Application tiles.
            </div>
          ) : (
            allowedCards.map((card, index) => (
              <Card
                key={`${card.title}-${index}`}
                title={card.title}
                description={card.description}
                image={card.image}
                onClick={() => navigate(card.route)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Application;