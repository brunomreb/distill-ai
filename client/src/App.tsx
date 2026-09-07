import { Outlet } from 'react-router-dom';
import { RoleProvider } from './context/RoleContext';
import { UserProvider } from './context/UserContext';
import { OrgProvider } from './context/OrgContext';
import { AppShell } from './components/shell/AppShell';

export default function App() {
  return (
    <UserProvider>
      <OrgProvider>
        <RoleProvider>
          <AppShell>
            <Outlet />
          </AppShell>
        </RoleProvider>
      </OrgProvider>
    </UserProvider>
  );
}
