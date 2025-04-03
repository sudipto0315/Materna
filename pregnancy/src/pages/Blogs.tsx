import React, { useState, useEffect, useCallback, memo } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import InfiniteScroll from "react-infinite-scroll-component";
import { useLanguage } from "@/contexts/LanguageContext"; // Import useLanguage hook
import axios from "axios";

// Memoized Blog Card to prevent unnecessary re-renders
const BlogCard = memo(({ blog }: { blog: Blog }) => (
  <a
    href={blog.url}
    key={blog.id}
    target="_blank"
    rel="noopener noreferrer"
    className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300 block hover:no-underline"
  >
    <div className="h-48 relative">
      <img
        src={blog.image}
        alt={blog.title}
        className="w-full h-full object-cover"
        onError={(e) => {
          (e.target as HTMLImageElement).src = '/images/fallback-blog.jpg';
        }}
      />
    </div>
    <div className="p-6">
      <h3 className="text-xl font-semibold mb-2 text-gray-800">
        {blog.title}
      </h3>
      <p className="text-gray-600 mb-4 line-clamp-3">
        {blog.description}
      </p>
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span className="max-w-[60%] truncate">
          {blog.author}
        </span>
        <span>
          {new Date(blog.publishedAt).toLocaleDateString()}
        </span>
      </div>
      <div className="mt-3 text-sm text-gray-400">
        Source: {blog.source}
      </div>
    </div>
  </a>
));

interface Blog {
  id: string;
  title: string;
  image: string;
  author: string;
  publishedAt: string;
  url: string;
  description: string;
  source: string;
}

const Blogs: React.FC = () => {
  const { language } = useLanguage(); // Access language context from navigation bar
  const [selectedCategory, setSelectedCategory] = useState<string | null>("nutrition");
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [allArticles, setAllArticles] = useState<any[]>([]); // Store all articles for pagination

  // Translation states
  const [isLoadingTranslation, setIsLoadingTranslation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [originalContent] = useState({
    heroTitle: "Pregnancy & Maternal Care Resources",
    heroDescription: "Trusted articles and research-based information for expecting mothers, curated from medical sources and maternal health experts.",
    exploreTitle: "Explore Pregnancy Topics",
    noArticlesMessage: "No articles found for {categoryName}. Try another category.",
    loadingMore: "Loading more articles...",
    endMessage: "You've reached all available articles in this category",
    selectCategory: "Select a category to view related articles",
    attribution: "Articles sourced from local data",
  });
  const [content, setContent] = useState(originalContent);

  const categories = [
    { id: "nutrition", name: "Pregnancy Nutrition", query: "pregnancy nutrition OR prenatal vitamins", file: "pregnancy_nutrition.json" },
    { id: "health", name: "Maternal Health", query: "maternal health OR pregnancy exercise", file: "pregnancy_health.json" },
    { id: "mental-health", name: "Mental Health", query: "pregnancy mental health OR postpartum depression", file: "pregnancy_mentalhealth.json" },
    { id: "preparation", name: "Birth Preparation", query: "birth preparation OR labor stages", file: "pregnancy_birthprep.json" },
  ];

  const fetchBlogs = async (initialLoad = false) => {
    if (!selectedCategory || isLoading) return;

    setIsLoading(true);
    try {
      const category = categories.find((c) => c.id === selectedCategory);
      if (!category) return;

      let articles = allArticles;
      if (initialLoad) {
        // Fetch the JSON file only on initial load
        const response = await fetch(`/${category.file}`);
        const data = await response.json();

        if (data.status !== "ok") throw new Error("Error loading JSON data");

        articles = data.articles;
        setAllArticles(articles); // Store all articles for pagination
      }

      // Pagination logic
      const pageSize = 5; // Load 5 articles per page
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;

      // Filter articles (less strict: only require title)
      const filteredArticles = articles.filter((a: any) => a.title);

      // Slice the filtered articles for the current page
      const newBlogs = filteredArticles
        .slice(startIndex, endIndex)
        .map((article: any) => ({
          id: article.url,
          title: article.title,
          image: article.urlToImage || '/images/fallback-blog.jpg', // Fallback if no image
          author: article.author || article.source.name,
          publishedAt: article.publishedAt,
          url: article.url,
          description: article.description,
          source: article.source.name,
        }));

      setBlogs((prev) => (initialLoad ? newBlogs : [...prev, ...newBlogs]));
      setHasMore(endIndex < filteredArticles.length); // Update hasMore based on filtered articles
      setPage((prev) => prev + 1);
    } catch (error) {
      console.error("Error fetching blogs:", error);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCategory) {
      setPage(1);
      setBlogs([]);
      setAllArticles([]); // Reset articles when category changes
      fetchBlogs(true);
    }
  }, [selectedCategory]);

  // Translation function
  const translateText = async (text: string, targetLang: string) => {
    if (targetLang === "en") return text;
    try {
      const response = await axios.post(
        `https://translation.googleapis.com/language/translate/v2?key=${import.meta.env.VITE_GOOGLE_API_KEY}`,
        {
          q: text,
          source: "en",
          target: targetLang,
          format: "text",
        }
      );
      return response.data.data.translations[0].translatedText;
    } catch (error) {
      console.error("Translation error:", error);
      setError("Failed to translate content.");
      return text;
    }
  };

  // Translate content based on language
  const translateContent = useCallback(async (targetLang: string) => {
    setIsLoadingTranslation(true);
    setError(null);
    const translatedContent = { ...originalContent };

    // Translate all fields
    for (const key in originalContent) {
      translatedContent[key as keyof typeof originalContent] = await translateText(
        originalContent[key as keyof typeof originalContent],
        targetLang
      );
    }

    setContent(translatedContent);
    setIsLoadingTranslation(false);
  }, [originalContent]);

  useEffect(() => {
    if (language === "en") {
      setContent(originalContent);
      setIsLoadingTranslation(false);
      setError(null);
    } else {
      translateContent(language);
    }
  }, [language, translateContent]);

  return (
    <Layout>
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-pink-100 to-red-50 py-16 px-4 text-center rounded-lg my-8">
        <h1 className="text-4xl font-bold mb-4 text-gray-800">
          {content.heroTitle}
        </h1>
        <p className="text-lg max-w-2xl mx-auto text-gray-600">
          {content.heroDescription}
        </p>
      </div>

      {/* Category Selector */}
      <div className="bg-white p-4 rounded-lg shadow-md mb-8">
        <h2 className="text-2xl font-semibold text-center mb-6 text-red-600">
          {content.exploreTitle}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`p-4 rounded-lg transition-all duration-300 ${
                selectedCategory === category.id
                  ? "bg-red-600 text-white shadow-lg"
                  : "bg-white text-red-600 hover:bg-red-50 border border-red-100"
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>

      {/* Blog List with Infinite Scroll */}
      {selectedCategory && (
        <InfiniteScroll
          dataLength={blogs.length}
          next={() => fetchBlogs()}
          hasMore={hasMore}
          loader={
            <div className="text-center my-8 text-gray-600">
              {content.loadingMore}
            </div>
          }
          endMessage={
            <div className="text-center my-8 text-gray-600">
              {content.endMessage}
            </div>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {blogs.length > 0 ? (
              blogs.map((blog) => (
                <BlogCard key={blog.id} blog={blog} />
              ))
            ) : (
              <div className="text-center my-8 text-gray-600 col-span-full">
                {content.noArticlesMessage.replace("{categoryName}", categories.find(c => c.id === selectedCategory)?.name || "")}
              </div>
            )}
          </div>
        </InfiniteScroll>
      )}

      {/* Attribution and Initial State */}
      {!selectedCategory ? (
        <div className="text-center py-16 text-gray-500">
          {content.selectCategory}
        </div>
      ) : (
        <div className="text-center text-sm text-gray-400 mt-8 pb-4">
          {content.attribution}
        </div>
      )}
    </Layout>
  );
};

export default Blogs;