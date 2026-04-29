import { useLocalStorage } from '../hooks/useLocalStorage';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { createStableId } from '../utils/id';

export function useActivities() {
    const [activities, setActivities] = useLocalStorage(STORAGE_KEYS.ACTIVITIES, []);

    const addActivity = (activity) => {
        setActivities(prev => [...prev, { ...activity, id: createStableId('activity-') }]);
    };

    const updateActivity = (updatedActivity) => {
        setActivities(prev => prev.map(a => a.id === updatedActivity.id ? updatedActivity : a));
    };

    const deleteActivity = (id) => {
        setActivities(prev => prev.filter(a => a.id !== id));
    };

    const updateActivityCalendarId = (id, calendarId) => {
        setActivities(prev => prev.map(a => a.id === id ? { ...a, calendarId } : a));
    };

    return { activities, setActivities, addActivity, updateActivity, deleteActivity, updateActivityCalendarId };
}