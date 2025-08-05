interface SearchBarProps {
  onSearchChange: (value: string) => void;
  onClear: () => void;
  loading?: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearchChange }) => (
  <div className="flex-1">
    <input
      type="text"
      placeholder="Search products..."
      onChange={(e) => onSearchChange(e.target.value)}
      className="w-full p-2 text-sm bg-background text-foreground placeholder:text-muted-foreground border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent outline-none transition-all"
    />
  </div>
);

export default SearchBar;
