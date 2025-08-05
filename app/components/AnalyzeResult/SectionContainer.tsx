interface SectionContainerProps {
  children: React.ReactNode;
  bgColor?: string;
}

const SectionContainer: React.FC<SectionContainerProps> = ({
  children,
  bgColor = "bg-muted/20",
}) => (
  <div className={`${bgColor} rounded-xl p-3 border border-border`}>
    {children}
  </div>
);

export default SectionContainer;
