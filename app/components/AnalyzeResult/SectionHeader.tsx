interface SectionHeaderProps {
  title: string;
  color: string;
  badge?: number;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  color,
  badge,
}) => (
  <h3 className="text-xl font-semibold text-card-foreground mb-4 flex items-center">
    <div className={`w-2 h-6 ${color} rounded-full mr-3`}></div>
    {title}
    {badge !== undefined && badge > 0 && (
      <span className="ml-2 bg-section-concerns text-primary-foreground text-xs px-2 py-1 rounded-full">
        {badge}
      </span>
    )}
  </h3>
);

export default SectionHeader;
