import math

import pandas as pd
import matplotlib.image as mpimg  # from PIL import Image
import numpy as np
import multiprocessing as mp


from tqdm import tqdm


def write_to_files(q, out_w2c, out_josa, out_Union_NoRep, out_Union,out_processed):
    '''listens for messages on the q, writes to files. '''
    while 1:
        res = q.get()
        if res=="kill":
            break
        fn,ann_w2c, ann_josa, ann_out_Union_NoRep, ann_Union = res
        ################ WRITING the w2c and Josa -based annotations #######################
        # out_w2c_OnlyDominant.write(getAnnotationImageCells(filename, t_OnlyDominant, colors_labels));
        # out_josa_OnlyDominant.write(getAnnotationImageCells(filename, tj_OnlyDominant, colors_labels));
        out_w2c.write(ann_w2c)
        out_josa.write(ann_josa)
        #################################################

        ################ WRITING the "UNION" annotations #######################
        # out_Union_OnlyDominant_NoRep.write(getAnnotationImageCells(filename, union_OnlyDominant_NoRep, colors_labels));
        # out_Union_OnlyDominant.write(getAnnotationImageCells(filename,union_OnlyDominant,colors_labels))
        out_Union_NoRep.write(ann_out_Union_NoRep)
        out_Union.write(ann_out_Union_NoRep)
        out_processed.write(fn+'\n')
    out_w2c.flush()
    out_josa.flush()
    out_Union_NoRep.flush()
    out_Union.flush()
    out_processed.flush()

def im2c(im, dominant_color_lookup_series, color_values=None):
    # if color_values is not null then the output is a colored image with color names
    # otherwise is a matrix with the ID of the dominat color for each pixel

    im_x = im.shape[0]
    im_y = im.shape[1]
    rr = im[:, :, 0].reshape(im_x * im_y)
    gg = im[:, :, 1].reshape(im_x * im_y)
    bb = im[:, :, 2].reshape(im_x * im_y)
    index_im = (np.floor(rr / 8) + 32 * np.floor(gg / 8) + 32 * 32 * np.floor(bb / 8)).astype(int)
    out = (dominant_color_lookup_series[index_im]).values
    out = out.reshape(im_x, im_y)

    if color_values is not None:
        out_img = np.zeros((im.shape[0], im.shape[1], 3), dtype='uint8')
        for i in range(im.shape[0]):
            for j in range(im.shape[1]):
                out_img[i][j] = np.asarray(color_values[out[i][j]], dtype='uint8') * 255
        return out_img

    return out


def extractCellcolors(im, nrows, ncols, color_lookup_table, thresholds=(0.3, 0.15, 0.3),
                      compute_only_dominant_color=False):
    # extractcolors outputs nrows x ncols cells each containing the arrays of idColors assigned to it
    # PARAMETER
    # (boolean) compute associatedColors :  is used to specify if associated colors
    #          should be computed (computeassociatedColors=true) or only dominat color
    #          should be computed (computeassociatedColors=false) for each cell
    th_dominant, th_associated, th_quotient_da = thresholds
    out = [None] * nrows * ncols
    np_row = math.floor(im.shape[0] / nrows)
    np_col = math.floor(im.shape[1] / ncols)
    areacell = np_row * np_col
    nColors = color_lookup_table.shape[1]
    colorsID = np.array([x for x in range(nColors)])

    dominatColorLookupSeries = color_lookup_table.idxmax(axis=1)

    count = 0
    for irow in range(nrows):
        for icol in range(ncols):
            subImg = im[irow * np_row:(irow + 1) * np_row, icol * np_col:(icol + 1) * np_col, :]

            areaForEachColor = np.zeros(nColors, dtype="float32")

            # only the dominat color for each pixel is considered
            pixelDominantColors = im2c(subImg, dominatColorLookupSeries);

            for j in range(nColors):
                areaForEachColor[j] = sum(sum(pixelDominantColors == j))

            areaForEachColor = areaForEachColor / areacell;
            dominantID = np.argmax(areaForEachColor)
            dominantArea = areaForEachColor[dominantID]
            listScoreID = []
            if dominantArea > th_dominant:
                listScoreID.append((dominantArea, dominantID))
                if (not compute_only_dominant_color):
                    areaForEachColor[dominantID] = 0
                    associatedColors = np.logical_and(areaForEachColor >= th_associated,
                                                      (areaForEachColor / dominantArea) >= th_quotient_da)
                    list_associatedColors = list(zip(areaForEachColor[associatedColors], colorsID[associatedColors]))
                    listScoreID[len(listScoreID):] = list_associatedColors

            # now using this area we should assign one or more colors to each
            # cell and store it in out
            listScoreID.sort(reverse=True)
            out[count] = listScoreID
            count += 1

    return out


def unionOfCellColorPredictions(t1, t2, norepetition=False):
    ncells = len(t1)
    if ncells !=len(t2): # just checking that the lens are the same....
        raise RuntimeError('Failed to do the union of lists of different lengths')
    out = [None] * ncells
    for i in range(ncells):
        l1 = t1[i]
        l2 = t2[i]
        lout = l1 + l2
        if (norepetition):
            d = {}
            for score, col in lout:
                if col in d:
                    d[col] = (d[col] + score) / 2.0  # da decidere!!!
                else:
                    d[col] = score / 2.0
            lout = [(score, col) for col, score in d.items()]
        lout.sort(reverse=True)
        out[i] = lout
    return out


def getImageColoredCells(cell_colors, size_cells, size_image, color_values,
                         undefined_color=(0, 1, 1)):
    nrows, ncols = size_cells
    sizex = size_image[0]
    sizey = size_image[1]
    out = np.zeros((sizex, sizey, 3), dtype='uint8')

    np_row = math.floor(sizex / nrows)
    np_col = math.floor(sizey / ncols)

    count_cell = 0
    for irow in range(nrows):
        for icol in range(ncols):

            col_id = cell_colors[count_cell]  # list of tuples
            count_cell += 1
            if len(col_id) < 1:
                col = undefined_color  # using cyan as standard
                rstart = irow * np_row
                cstart = icol * np_col
                out[rstart:rstart + np_row, cstart: cstart + np_col, 0] = col[0] * 255
                out[rstart:rstart + np_row, cstart: cstart + np_col, 1] = col[1] * 255
                out[rstart:rstart + np_row, cstart: cstart + np_col, 2] = col[2] * 255

            else:
                count = 0
                rstep = math.floor(np_row / len(col_id))
                for score, idColor in col_id:
                    col = color_values[idColor]
                    rstart = irow * np_row + rstep * count
                    cstart = icol * np_col
                    out[rstart: rstart + rstep, cstart: cstart + np_col, 0] = col[0] * 255
                    out[rstart: rstart + rstep, cstart: cstart + np_col, 1] = col[1] * 255
                    out[rstart: rstart + rstep, cstart:cstart + np_col, 2] = col[2] * 255
                    count = count + 1
    return out


def get_annotation_image_cells(filename, cell_colors, clabels):
    s = ';'.join(
        [','.join([str(score) + ',' + clabels[col] for score, col in listScoreID]) for listScoreID in cell_colors])

    return filename + ';' + s + '\n'


class ColorAnnotation:
    # class variable shared by all instances
    lut_josa_tab_FN = './data/colorLookupTables/LUT_JOSA.txt'
    w2c_tab_FN = './data/colorLookupTables/w2c.txt'
    colors_labels = {0: 'black',
                     1: 'blue',
                     2: 'brown',
                     3: 'grey',
                     4: 'green',
                     5: 'orange',
                     6: 'pink',
                     7: 'purple',
                     8: 'red',
                     9: 'white',
                     10: 'yellow'}
    color_values = {0: [0, 0, 0],
                    1: [0, 0, 1],
                    2: [.5, .4, .25],
                    3: [.5, .5, .5],
                    4: [0, 1, 0],
                    5: [1, .8, 0],
                    6: [1, .5, 1],
                    7: [1, 0, 1],
                    8: [1, 0, 0],
                    9: [1, 1, 1],
                    10: [1, 1, 0]}

    def __init__(self, ncols, nrows, ths, out_Folder="./out/", optional_argument="Default Value"):
        # instance variable unique to each instance
        self.ncols = ncols
        self.nrows = nrows
        self.ths = ths
        self.out_Folder = out_Folder
        self.w2c, self.josa = self.import_lookup_tables()
        # #set out FN
        # self.out_w2c_FN = out_Folder + 'colorAnnotation_w2c.txt'
        # self.out_josa_FN = out_Folder + 'colorAnnotation_josa.txt'
        # self.out_w2c_OnlyDominant_FN = out_Folder + 'colorAnnotation_w2c_OnlyDominantColors.txt'
        # self.out_josa_OnlyDominant_FN = out_Folder + 'colorAnnotation_josa_OnlyDominantColors.txt'
        # self.out_Union_OnlyDominant_FN='colorAnnotation_UNION_OnlyDominantColors.txt'
        # self.out_Union_OnlyDominant_NoRep_FN = out_Folder + 'colorAnnotation_UNION_OnlyDominantColors_NoRepetition.txt'
        # self.out_Union_NoRep_FN = out_Folder + 'colorAnnotation_UNION_NoRepetition.txt'
        # self.out_Union_FN = out_Folder + 'colorAnnotation_UNION.txt'

    def print_info(self):
        print(f"\t Lookup Tables:\n \t\t{self.w2c_tab_FN} \n \t\t{self.lut_josa_tab_FN}")
        print(f"The color annotations are saved in the folder: {self.out_Folder}")
        print("colors Labels=", self.colors_labels, '\n')
        print("colors Values=", self.color_values, '\n')

    def import_lookup_tables(self):
        # IMPORTING LOOKUP TABLES
        col_names = ['R', 'G', 'B'] + list(self.color_values.keys())

        # Importing w2c
        w2c = pd.read_csv(self.w2c_tab_FN, sep=" ", header=None)
        w2c.dropna(axis=1, inplace=True)
        w2c=w2c.set_axis(col_names, axis=1)

        # Importing lut_josa
        josa = pd.read_csv(self.lut_josa_tab_FN, sep=" ", header=None)
        josa.dropna(axis=1, inplace=True)
        josa.set_axis(col_names, axis=1, inplace=True)
        return w2c, josa

    def annotate_single_image(self, filename): # worker
        try:
            im = mpimg.imread(filename)
            if im.dtype != np.uint8:
                im = (im * 255).round().astype(np.uint8)
            # print(f"dtype:{im.dtype} --- shape {im.shape}")

            ############### COMPUTING the w2c and Josa -based annotations #######################
            ## ONLY DOMINANT COLORS
            # t_OnlyDominant = extractCellcolors(im, nrows, ncols, w2c.iloc[:, 3:], ths, True)
            # tj_OnlyDominant = extractCellcolors(im, nrows, ncols, josa.iloc[:, 3:], ths,True);
            ## WithAssociatedColors
            t = extractCellcolors(im, self.nrows, self.ncols, self.w2c.iloc[:, 3:], thresholds=self.ths)
            tj = extractCellcolors(im, self.nrows, self.ncols, self.josa.iloc[:, 3:], thresholds=self.ths)

            ################ COMPUTING "UNION" annotations #######################
            # compute UNION between annotation obtained by the two lookup tables

            # union_OnlyDominant_NoRep = unionOfCellColorPredictions(t_OnlyDominant, tj_OnlyDominant, True)
            # union_OnlyDominant=unionOfCellColorPredictions(t_OnlyDominant,tj_OnlyDominant)

            union_NoRep = unionOfCellColorPredictions(t, tj, True)
            union = unionOfCellColorPredictions(t, tj)

            ################ computing the w2c and Josa -based annotations #######################
            # ann_w2c_OnlyDominant=getAnnotationImageCells(filename, t_OnlyDominant, colors_labels)
            # ann_josa_OnlyDominant=getAnnotationImageCells(filename, tj_OnlyDominant, colors_labels)
            ann_w2c = get_annotation_image_cells(filename, t, self.colors_labels)
            ann_josa = get_annotation_image_cells(filename, tj, self.colors_labels)
            #################################################

            ################ conputing the "UNION" annotations #######################
            # ann_Union_OnlyDominant_NoRep=getAnnotationImageCells(filename, union_OnlyDominant_NoRep, colors_labels)
            # ann_Union_OnlyDominant=getAnnotationImageCells(filename,union_OnlyDominant,colors_labels)
            ann_out_Union_NoRep = get_annotation_image_cells(filename, union_NoRep, self.colors_labels)
            ann_Union = get_annotation_image_cells(filename, union, self.colors_labels)
            res = filename,ann_w2c, ann_josa, ann_out_Union_NoRep, ann_Union
          # q.put(res)
            return res
        except IOError:
            # filename not an image file
            print(f"--Skipping {filename} as it is not recognized as an image")
            return None


    def annotate(self, list_filenames):
        out_w2c = open(self.out_Folder + 'colorAnnotation_w2c.txt', 'w')  # //usare append?
        out_josa = open(self.out_Folder + 'colorAnnotation_josa.txt', 'w')
        # out_w2c_OnlyDominant = open(out_Folder + 'colorAnnotation_w2c_OnlyDominantColors.txt', 'w')
        # out_josa_OnlyDominant = open(out_Folder + 'colorAnnotation_josa_OnlyDominantColors.txt', 'w')
        # out_Union_OnlyDominant=open(out_Folder+'colorAnnotation_UNION_OnlyDominantColors.txt','w')
        # out_Union_OnlyDominant_NoRep = open(out_Folder + 'colorAnnotation_UNION_OnlyDominantColors_NoRepetition.txt', 'w')
        out_Union_NoRep = open(self.out_Folder + 'colorAnnotation_UNION_NoRepetition.txt', 'w')
        out_Union = open(self.out_Folder + 'colorAnnotation_UNION.txt', 'w')
        out_processed=open(self.out_Folder + 'processed.txt', 'w')

        count = len(list_filenames)
        print(f'starting computations on max {6} cores')
        manager = mp.Manager()
        # stop_event = manager.Event()
        q = manager.Queue()
        #pool = mp.Pool(mp.cpu_count()) #mp.get_context("spawn").
        semaphore = mp.Semaphore(6)
        pool=mp.Pool(6) # no of cpus of your system.
        i=0
        for res in tqdm(pool.imap_unordered(self.annotate_single_image, list_filenames), total=count):
            if(res is not None):
                 q.put(res)
            i+=1
            if (i  % 2000 == 0):
                q.put("kill")
                ##print(f"{i }----{(i) * 100 // count}%")
                write_to_files(q, out_w2c, out_josa, out_Union_NoRep, out_Union,out_processed)
                q = manager.Queue()
        q.put("kill")
        write_to_files(q, out_w2c, out_josa, out_Union_NoRep, out_Union, out_processed)

        print(f"completed")
        # self.write_to_files(q, self.out_w2c, self.out_josa, self.out_Union_NoRep, self.out_Union)

        out_w2c.close()
        out_josa.close()
        # out_w2c_OnlyDominant.close()
        # out_josa_OnlyDominant.close()
        # out_Union_OnlyDominant_NoRep.close()
        # out_Union_OnlyDominant.close()
        out_Union_NoRep.close()
        out_Union.close()
