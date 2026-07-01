import React, { useState } from 'react';
import styles from './Header.module.scss';
import snowflakecapgeminilogo from '../../../assets/snowflake_capgemini-logo.svg';
import aiscalabilityLogo from '../../../assets/AI_Scalability_Platform.svg';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';

import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
import ListItemIcon from '@mui/material/ListItemIcon';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import SettingsIcon from '@mui/icons-material/Settings';

import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../../constants';
import AboutDialog from '../../../pages/About/AboutDialog';
import { useAppContext } from '../../../context/AppContext';

const Header: React.FC = () => {
  const navigate = useNavigate();
  const { currentRole } = useAppContext();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [openAbout, setOpenAbout] = useState(false);

  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => setAnchorEl(null);

  return (
    <>
      <header className={styles.header}>
        <div className={styles.left}>
          <img className={styles.logo} src={aiscalabilityLogo} />
          <img
            src={snowflakecapgeminilogo}
            className={styles.logoprimary}
            alt="Snowflake+Capgemini"
          />
        </div>

        <div className={styles.right} onClick={handleClick} style={{ cursor: 'pointer' }}>
          <AccountCircleIcon />
          <div className={styles.user}>{currentRole ?? 'Loading...'}</div>
        </div>
      </header>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
      >
        <MenuItem
          onClick={() => {
            handleClose();
            setOpenAbout(true);
          }}
        >
          <ListItemIcon>
            <InfoOutlinedIcon fontSize="small" />
          </ListItemIcon>
          About
        </MenuItem>

        <MenuItem
          onClick={() => {
            handleClose();
            navigate(ROUTES.SETTINGS);
          }}
        >
          <ListItemIcon>
            <SettingsIcon fontSize="small" />
          </ListItemIcon>
          Settings
        </MenuItem>

        <Divider />

        {currentRole === 'RAISE_ADMIN' && (
          <MenuItem
            onClick={() => {
              handleClose();
              navigate(ROUTES.ACCESS_CONTROL);
            }}
          >
            <ListItemIcon>
              <AdminPanelSettingsOutlinedIcon fontSize="small" />
            </ListItemIcon>
            Access Control
          </MenuItem>
        )}
      </Menu>

      <AboutDialog open={openAbout} onClose={() => setOpenAbout(false)} />
    </>
  );
};

export default Header;
``;
