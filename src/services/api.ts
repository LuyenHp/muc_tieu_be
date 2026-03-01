import axios from 'axios';

// Replace with your Web App URL after deploying Google Apps Script
const API_URL: string = 'https://script.google.com/macros/s/AKfycbzGY3Wcg7k9zLkDnRsIjCzEO7Vzz8GFWgKJhGsH4CJyqVvRS-VkRorfZ_WhFAf0Nc4H/exec';

export interface Task {
    id: number;
    title: string;
    imageUrl: string;
    progress: boolean[];
}

export interface ChildInfo {
    startDate: string;
    endDate: string;
    rewardName: string;
    rewardImage: string;
    avatarUrl?: string;
}

export interface Child {
    name: string;
    avatarUrl?: string;
}

export const fetchChildren = async (): Promise<Child[]> => {
    const response = await axios.get(API_URL);
    const data = response.data.children || [];
    // Normalize to handle both old string[] and new Child[] formats
    return data.map((item: any) => {
        if (typeof item === 'string') return { name: item };
        return item;
    });
};

export const fetchTasks = async (childName: string): Promise<{ tasks: Task[], info: ChildInfo }> => {
    try {
        const response = await axios.get(`${API_URL}?child=${encodeURIComponent(childName)}`);
        return {
            tasks: response.data.tasks || [],
            info: response.data.info
        };
    } catch (error) {
        console.error('Fetch failed', error);
        return { tasks: [], info: { startDate: '', endDate: '', rewardName: '', rewardImage: '' } };
    }
};

export const updateTaskStatus = async (childName: string, taskId: number, dayIndex: number, value: boolean) => {
    await fetch(API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
            'Content-Type': 'text/plain',
        },
        body: JSON.stringify({
            child: childName,
            action: 'update',
            taskId,
            dayIndex,
            value
        })
    });
};


export const createChild = async (
    name: string,
    tasks: { title: string; imageUrl: string }[],
    info: ChildInfo
) => {
    await fetch(API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
            'Content-Type': 'text/plain',
        },
        body: JSON.stringify({
            action: 'create_child',
            name,
            tasks,
            ...info
        })
    });
};

export const updateChildProfile = async (
    name: string,
    tasks: { title: string; imageUrl: string }[],
    info: ChildInfo,
    preserveProgress: boolean = true
) => {
    await fetch(API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
            'Content-Type': 'text/plain',
        },
        body: JSON.stringify({
            action: 'update_profile',
            name,
            tasks,
            ...info,
            preserveProgress
        })
    });
};
