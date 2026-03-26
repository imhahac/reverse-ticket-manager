import { useLocalStorage } from '../hooks/useLocalStorage';

export function useActivities() {
    const [activities, setActivities] = useLocalStorage('reverse-activities', []);

    const addActivity = (activity) => {
        setActivities(prev => [...prev, { ...activity, id: Date.now().toString() }]);
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