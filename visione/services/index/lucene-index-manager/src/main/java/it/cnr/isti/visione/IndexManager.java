package it.cnr.isti.visione;

import java.io.BufferedReader;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.Reader;
import java.nio.charset.Charset;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Iterator;
import java.util.Map;
import java.util.List;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import java.util.zip.GZIPInputStream;

import org.apache.lucene.analysis.Analyzer;
import org.apache.lucene.analysis.TokenStream;
import org.apache.lucene.analysis.Tokenizer;
import org.apache.lucene.analysis.core.WhitespaceTokenizer;
import org.apache.lucene.analysis.miscellaneous.DelimitedTermFrequencyTokenFilter;
import org.apache.lucene.document.Document;
import org.apache.lucene.document.Field;
import org.apache.lucene.document.FieldType;
import org.apache.lucene.document.StoredField;
import org.apache.lucene.document.TextField;
import org.apache.lucene.index.DirectoryReader;
import org.apache.lucene.index.IndexOptions;
import org.apache.lucene.index.IndexReader;
import org.apache.lucene.index.IndexWriter;
import org.apache.lucene.index.IndexWriterConfig;
import org.apache.lucene.index.IndexWriterConfig.OpenMode;
import org.apache.lucene.index.Term;
import org.apache.lucene.search.IndexSearcher;
import org.apache.lucene.search.Query;
import org.apache.lucene.search.TermQuery;
import org.apache.lucene.store.FSDirectory;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.gson.JsonElement;

import me.tongfei.progressbar.ProgressBar;
import net.sourceforge.argparse4j.ArgumentParsers;
import net.sourceforge.argparse4j.impl.action.StoreTrueArgumentAction;
import net.sourceforge.argparse4j.inf.ArgumentParser;
import net.sourceforge.argparse4j.inf.MutuallyExclusiveGroup;
import net.sourceforge.argparse4j.inf.Namespace;
import net.sourceforge.argparse4j.inf.Subparser;
import net.sourceforge.argparse4j.inf.Subparsers;

public class IndexManager {

    /* Whitespace Analyzer + DelimitedTermFrequencyTokenFilter */
    protected static class TermFrequencyAnalyzer extends Analyzer {

        @Override
        protected TokenStreamComponents createComponents(String fieldName) {
            Tokenizer source = new WhitespaceTokenizer();
            TokenStream result = new DelimitedTermFrequencyTokenFilter(source);
            return new TokenStreamComponents(source, result);
        }

    }

    /* FieldType for Stored Searchable Fields */
    protected static FieldType storedTextFieldType = new FieldType(TextField.TYPE_STORED) {{
        setIndexOptions(IndexOptions.DOCS);
        setOmitNorms(true);
    }};

    /* FieldType for Surrogate Text Representation Fields */
    protected static FieldType surrogateTextFieldType = new FieldType(TextField.TYPE_NOT_STORED) {{
        setIndexOptions(IndexOptions.DOCS_AND_FREQS);
        setStoreTermVectors(true);
    }};

    public static void main(String[] args) throws IOException {
        ArgumentParser parser = ArgumentParsers.newFor("IndexManager").build().defaultHelp(true)
                .description("Manages Lucene indices of a VISIONE collection.");

        parser.addArgument("index_dir").help("directory in which the index is stored");

        Subparsers subparsers = parser.addSubparsers().help("sub-command help");

        // add sub-command
        Subparser addParser = subparsers.addParser("add").setDefault("command", "add").help("add/replace documents in an index");
        addParser.addArgument("--save-every").type(Integer.class).setDefault(200).help("commit index every this amount of indexed documents");
        addParser.addArgument("-f", "--force").action(new StoreTrueArgumentAction()).help("whether to replace existing document or skip insertion");
        addParser.addArgument("documents_file_template").help("jsonl.gz file containing documents to be added; {video_id} will be replaced with the video id");
        MutuallyExclusiveGroup group = addParser.addMutuallyExclusiveGroup("video_ids_input").required(true);
        group.addArgument("--video-ids-list-path").help("path to a file containing a list of video ids to be added");
        group.addArgument("--video-ids").help("id of the video to which input documents belong");

        // remove sub-command
        Subparser rmParser = subparsers.addParser("remove").setDefault("command", "remove").help("remove docs from an index");
        rmParser.addArgument("video_ids").nargs("+").help("ID(s) of video(s) to remove");

        Namespace ns = parser.parseArgsOrFail(args);

        // call the method specified by the sub-command
        String subCommand = ns.getString("command");
        switch (subCommand) {
            case "add": add(ns); break;
            case "remove": remove(ns); break;
            default: parser.printUsage(); System.exit(1);
        }
    }

    public static void add(Namespace ns) throws IOException {

        int saveEvery = ns.getInt("save_every"); // TODO not used yet
        String documentsFileTemplate = ns.getString("documents_file_template");
        String videoIdsListPath = ns.getString("video_ids_list_path");
        String videoId = ns.getString("video_ids");
        String indexDirectory = ns.getString("index_dir");
        boolean force = ns.getBoolean("force");

        // open the index dir
        Path absolutePath = Paths.get(indexDirectory, "");
        FSDirectory index = FSDirectory.open(absolutePath);

        Stream<String> videoIds;
        if (videoIdsListPath != null) {
            videoIds = Files.lines(Paths.get(videoIdsListPath)).map(String::trim);
        } else {
            videoIds = Stream.of(videoId);
        }

        startCliProgress();
        videoIds.forEach(vId -> { try {
                addOne(vId, documentsFileTemplate.replace("{video_id}", vId), index, force);
            } catch (IOException e) { e.printStackTrace(); }
        });
        endCliProgress();

    }

    protected static void addOne(String videoId, String documentsFile, FSDirectory index, boolean force) throws IOException {

        // skip if documents of this video already exists
        Term videoIdTerm = new Term("videoID", videoId);

        if (!force && DirectoryReader.indexExists(index)) {
            IndexReader reader = DirectoryReader.open(index);
            IndexSearcher searcher = new IndexSearcher(reader);

            Query query = new TermQuery(videoIdTerm);
            long hits = searcher.search(query, 1).totalHits;
            if (hits > 0) {
                System.out.println("Found " + hits + " documents for video '" + videoId + "': skipping...");
                initial += hits;
                return;
            }
        }

        // configure index writer
        Analyzer analyzer = new TermFrequencyAnalyzer(); // parses "term1|freq1 term2|freq2 ..."
        IndexWriterConfig conf = new IndexWriterConfig(analyzer);
        conf.setOpenMode(OpenMode.CREATE_OR_APPEND);

        try (
            // documents file
            InputStream fileStream = new FileInputStream(documentsFile);
            InputStream gzipStream = new GZIPInputStream(fileStream);
            Reader decoder = new InputStreamReader(gzipStream, Charset.forName("UTF-8"));
            BufferedReader buffered = new BufferedReader(decoder);
            Stream<String> lines = buffered.lines();
        ) {
            // iterates over json objects
            Stream<Document> documents = lines
                .map(line -> JsonParser.parseString(line).getAsJsonObject())  // lines to json objects
                .map(IndexManager::createDocument)
                .map(IndexManager::printCliProgress);

            Iterable<Document> documentsWithProgressBar = (Iterable<Document>) ProgressBar.wrap(documents, "Indexing")::iterator;

            int count = 0; // TODO
            try (IndexWriter writer = new IndexWriter(index, conf)) {
                writer.updateDocuments(videoIdTerm, documentsWithProgressBar);
            }
        }
    }

    public static void remove(Namespace ns) throws IOException {
        List<String> videoIds = ns.getList("video_ids");
        String indexDirectory = ns.getString("index_dir");

        // open the index dir
        Path absolutePath = Paths.get(indexDirectory, "");
        FSDirectory index = FSDirectory.open(absolutePath);

        if (!DirectoryReader.indexExists(index)) {
            System.err.println("Lucene index not found: " + indexDirectory);
            System.exit(1);
        }

        // configure index writer
        Analyzer analyzer = new TermFrequencyAnalyzer(); // parses "term1|freq1 term2|freq2 ..."
        IndexWriterConfig conf = new IndexWriterConfig(analyzer);
        conf.setOpenMode(OpenMode.APPEND);

        try (IndexWriter writer = new IndexWriter(index, conf)) {
            Term[] videoIdTerms = videoIds.stream().map(videoId -> new Term("videoID", videoId)).toArray(Term[]::new);
            writer.deleteDocuments(videoIdTerms);
        }

    }

    protected static Document createDocument(JsonObject record) {
        Document doc = new Document();

        record.entrySet().stream()
            .map(IndexManager::getLuceneField)
            .filter(field -> field != null)
            .forEach(field -> doc.add(field));

        return doc;
    }

    // Management of progress prints for the VISIONE CLI
    protected static int initial = 0;
    protected static int total = -1;
    protected static void startCliProgress() {
        System.out.println(String.format("progress: %d/%d", initial, total));
    }

    protected static <T> T printCliProgress(T obj) {
        initial++;
        System.out.println(String.format("progress: %d/%d", initial, total));
        return obj;
    }

    protected static void endCliProgress() {
        total = (total < 0) ? initial : total;
        System.out.println(String.format("progress: %d/%d", initial, total));
    }

    protected static Field getLuceneField(Map.Entry<String,JsonElement> field) {
        String fieldName = field.getKey();
        JsonElement fieldValue = field.getValue();

        switch (fieldName) {
            // string stored and searchable fields
            case "imgID":
            case "videoID":
                return new Field(fieldName, fieldValue.getAsString(), storedTextFieldType);

            // stored int fields
            case "startframe":
            case "endframe":
            case "middleframe":
                return new StoredField(fieldName, fieldValue.getAsInt());

            // stored double fields
            case "starttime":
            case "endtime":
            case "middletime":
                return new StoredField(fieldName, fieldValue.getAsDouble());

            // indexed STR fields
            case "txt":
            case "objects":
            case "features":
            case "aladin":
            case "features_clip-openai-clip-vit-large-patch14_str":
            case "features_clip-laion-CLIP-ViT-H-14-laion2B-s32B-b79K_str":
                return new Field(fieldName, fieldValue.getAsString(), surrogateTextFieldType);

            // ignored fields
            case "":
                return null;

            // stored string field
            default:
                return new StoredField(fieldName, fieldValue.getAsString());
        }
    }
}
