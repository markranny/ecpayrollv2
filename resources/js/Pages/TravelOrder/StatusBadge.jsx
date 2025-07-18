// resources/js/Pages/TravelOrder/TravelOrderStatusBadge.jsx
import React from 'react';

const TravelOrderStatusBadge = ({ status }) => {
    let bgColor = '';
    let textColor = 'text-white';
    let label = '';
    
    switch(status) {
        case 'pending':
            bgColor = 'bg-yellow-500';
            label = 'Pending';
            break;
        case 'approved':
            bgColor = 'bg-green-500';
            label = 'Approved';
            break;
        case 'rejected':
            bgColor = 'bg-red-500';
            label = 'Rejected';
            break;
        case 'completed':
            bgColor = 'bg-blue-500';
            label = 'Completed';
            break;
        case 'cancelled':
            bgColor = 'bg-gray-500';
            label = 'Cancelled';
            break;
        default:
            bgColor = 'bg-gray-500';
            label = status && status.charAt(0).toUpperCase() + status.slice(1);
    }
    
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bgColor} ${textColor}`}>
            {label}
        </span>
    );
};

export default TravelOrderStatusBadge;