import React, { useState, useMemo } from 'react';
import { Paper, Typography, List, ListItemButton, ListItemText, Chip, Box, Pagination } from '@mui/material';
import CodeIcon from '@mui/icons-material/Code';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

const severityColor = (sev) => {
  switch (sev) {
    case 'high':
      return 'error';
    case 'medium':
      return 'warning';
    case 'low':
      return 'info';
    default:
      return 'default';
  }
};

const severityIcon = (sev) => {
  switch (sev) {
    case 'high':
      return <PriorityHighIcon fontSize="small" />;
    case 'medium':
      return <PriorityHighIcon fontSize="small" />;
    case 'low':
      return <CheckCircleOutlineIcon fontSize="small" />;
    default:
      return null;
  }
};

const SuggestionList = ({ suggestions = [], onSelect, selectedIndex = -1, pageSize = 10 }) => {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil((suggestions?.length || 0) / pageSize));
  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return suggestions.slice(start, start + pageSize);
  }, [suggestions, page, pageSize]);
  
  return (
    <Paper 
      sx={{ 
        p: 3, 
        height: '100%',
        borderRadius: 'xl',
        boxShadow: 'glass',
        transition: 'all 0.3s ease',
        '&:hover': {
          boxShadow: 'hover',
          transform: 'translateY(-4px)'
        },
        background: 'glass-card',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.1)'
      }}
      className="animate-fade-in hover-scale"
    >
      <Typography 
        variant="h6" 
        gutterBottom 
        sx={{ 
          fontWeight: 600, 
          display: 'flex', 
          alignItems: 'center',
          fontFamily: 'display',
          background: 'linear-gradient(135deg, #30336b, #3B3B98)',
          backgroundClip: 'text',
          textFillColor: 'transparent'
        }}
        className="animate-fade-in"
      >
        Modernization Suggestions
      </Typography>
      
      {suggestions === null ? (
        <Box 
          sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            py: 4
          }}
          className="animate-fade-in"
        >
          {[1, 2, 3, 4].map((i) => (
            <Box 
              key={i}
              sx={{ 
                width: '80%', 
                height: '24px', 
                bgcolor: 'rgba(0,0,0,0.11)', 
                borderRadius: '4px',
                mb: 2,
                animation: 'pulse 1.5s infinite ease-in-out',
                animationDelay: `${i * 0.2}s`
              }} 
            />
          ))}
        </Box>
      ) : suggestions.length === 0 ? (
        <Box 
          sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            py: 4,
            opacity: 0.7
          }}
          className="animate-fade-in"
        >
          <CheckCircleOutlineIcon sx={{ fontSize: 40, mb: 2, color: 'success.main' }} />
          <Typography variant="body1" color="text.secondary">No suggestions generated.</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            The scan didn't find any modernization opportunities.
          </Typography>
        </Box>
      ) : (
        <>
        <List 
          dense 
          role="list" 
          aria-label="Modernization suggestions list"
          sx={{ 
            '& .MuiListItemButton-root': {
              borderRadius: '4px',
              mb: 0.5,
              transition: 'all 0.2s ease',
              '&:hover': {
                backgroundColor: 'rgba(25, 118, 210, 0.08)',
                transform: 'translateX(4px)'
              },
              '&.Mui-selected': {
                backgroundColor: 'primary.light',
                color: 'primary.contrastText',
                '&:hover': {
                  backgroundColor: 'primary.main',
                }
              }
            }
          }}
        >
          {pageItems.map((s, i) => {
            const globalIndex = (page - 1) * pageSize + i;
            return (
            <ListItemButton
              key={`${s.file || 'general'}:${s.line || globalIndex}`}
              selected={globalIndex === selectedIndex}
              onClick={() => onSelect?.(globalIndex)}
              className="transition-all duration-300 hover:shadow-md"
            >
              <ListItemText
                primary={
                  <Typography 
                    variant="body1" 
                    sx={{ 
                      fontWeight: globalIndex === selectedIndex ? 600 : 400,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {s.description || 'Suggestion'}
                  </Typography>
                }
                secondary={
                  <Box 
                    component="span" 
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      mt: 0.5,
                      fontSize: '0.75rem'
                    }}
                  >
                    <CodeIcon sx={{ fontSize: '0.875rem', mr: 0.5, opacity: 0.7 }} />
                    {s.file ? `${s.file}${s.line ? `:${s.line}` : ''}` : 'General suggestion'}
                  </Box>
                }
              />
              <Box sx={{ ml: 2 }}>
                <Chip 
                  size="small" 
                  color={severityColor(s.severity)} 
                  label={s.severity || 'info'}
                  icon={severityIcon(s.severity)}
                  sx={{ 
                    fontWeight: 500,
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      transform: 'scale(1.05)'
                    }
                  }}
                />
              </Box>
            </ListItemButton>
            );
          })}
        </List>
        {totalPages > 1 && (
          <Box 
            sx={{ 
              display: 'flex', 
              justifyContent: 'center', 
              mt: 2,
              pt: 1,
              borderTop: '1px solid',
              borderColor: 'divider'
            }}
          >
            <Pagination 
              count={totalPages} 
              page={page} 
              onChange={(_, p) => setPage(p)} 
              size="small"
              color="primary"
              sx={{
                '& .MuiPaginationItem-root': {
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    transform: 'scale(1.1)'
                  }
                }
              }}
            />
          </Box>
        )}
        </>
      )}
    </Paper>
  );
};

export default SuggestionList;